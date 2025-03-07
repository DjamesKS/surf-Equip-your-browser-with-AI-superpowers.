import { getPageOpts, MinifiedElement } from "@repo/types";
import { CursorCoordinate } from "@src/pages/majordomo/provider";
import { TakeOverState } from "@src/pages/majordomo/take-over";
import { MutableRefObject } from "react";
import { toast } from "sonner";

import { evaluateActions } from "../ai/api/evaluate-actions";
import { summarizeAction } from "../ai/api/summarize-action";
import { minifyDom } from "../dom/minify-dom";
import { IS_DEBUGGING, USE_AI_EVALS_FOR_PREV_ACTIONS } from "../env";
import { ActionMetadata, ActionState } from "../interface/action-metadata";
import { ExtensionState } from "../interface/state";
import { ThinkingState } from "../interface/thinking-state";
import { sleep } from "../utils";
import {
  generateAction,
  takeBackAction,
  takeClarifyAction,
  takeClickAction,
  takeInputAction,
  takeNavigateAction,
  takeRefreshAction,
} from "./actions";

const MAX_RUN_STEPS = 10;

export async function runUntilCompletion({
  stateManager,
  historyManager,
  userInputOpts,
  cursorOpts,
}: {
  stateManager: {
    loadState: () => Promise<ExtensionState | null>;
    clearState: (expl: string) => Promise<void>;
    errorState: (error: string) => Promise<void>;
    setThinkingState: React.Dispatch<React.SetStateAction<ThinkingState>>;
  };
  historyManager: {
    getLatestActions: () => Promise<ActionMetadata[] | null | undefined>;
    appendHistory: ({
      step,
      action,
    }: {
      step: number;
      action: ActionMetadata;
    }) => Promise<void>;
    incrStep: () => void;
    applyEvaluations: ({
      evaluation,
    }: {
      evaluation: boolean[];
    }) => Promise<void>;
  };
  userInputOpts: {
    clarifyInputRef: MutableRefObject<(() => Promise<string>) | null>;
    overlayBlurRef: MutableRefObject<((blur: boolean) => void) | null>;
    checkTakeOverRef: MutableRefObject<boolean>;
    takeOverRef: MutableRefObject<(() => Promise<void>) | null>;
    setTakeOverStateRef: MutableRefObject<React.Dispatch<
      React.SetStateAction<TakeOverState>
    > | null>;
  };
  cursorOpts: {
    performClickRef: MutableRefObject<(() => void) | null>;
    updateCursorPosition: (coord: CursorCoordinate) => Promise<void>;
    setCursorPosition: React.Dispatch<React.SetStateAction<CursorCoordinate>>;
  };
}) {
  const { loadState, clearState, errorState, setThinkingState } = stateManager;
  const state = await loadState();
  if (!state) {
    toast.info("state is null");
    return;
  }
  const { userIntent } = state;
  const { getLatestActions, appendHistory, applyEvaluations, incrStep } =
    historyManager;
  const {
    clarifyInputRef,
    overlayBlurRef,
    checkTakeOverRef,
    takeOverRef,
    setTakeOverStateRef,
  } = userInputOpts;
  const pageOpts = getPageOpts(window.location.href);

  try {
    let i = 0;
    let runInProgress = true;
    let querySelector: string | undefined;
    let runnable: (() => Promise<any>) | undefined;

    while (i < MAX_RUN_STEPS && runInProgress) {
      i += 1;
      setThinkingState({ type: "awaiting_ui_changes" });
      await sleep(1500);

      const minifiedElements = minifyDom({
        document: document.body,
        pageOpts,
      });

      const latestActions = await getLatestActions();
      if (latestActions) {
        let evaluation = Array(latestActions.length).fill(true);
        if (USE_AI_EVALS_FOR_PREV_ACTIONS) {
          evaluation = await evaluateActions({
            latestActions,
            minifiedElements,
          });
        }
        applyEvaluations({ evaluation });
      }

      const updatedState = await loadState();
      if (!updatedState) {
        throw new Error(
          "runUntilCompletion: unable to load state after updating it",
        );
      }
      const { history } = updatedState;
      console.log("History:", history);

      setThinkingState({ type: "deciding_action" });
      const actions = await generateAction({
        userIntent,
        minifiedElements,
        history,
        pageOpts,
      });
      if (actions.length === 0) {
        throw new Error("generateAction: no action generated");
      }
      console.log("Actions:", actions);

      for (const action of actions) {
        setThinkingState({ type: "action", action });
        switch (action.type) {
          case "navigate":
            const navigateActionResponse = await takeNavigateAction({
              url: action.url,
            });
            runnable = navigateActionResponse.runnable;
            break;

          case "clarify":
            const clarifyActionResponse = await takeClarifyAction({
              clarifyInputRef,
              overlayBlurRef,
            });
            runnable = clarifyActionResponse.runnable;
            break;

          case "click":
            setThinkingState({ type: "clicking_button" });
            querySelector = getQuerySelectorFromIndex({
              minifiedElements,
              idx: action.idx,
            });
            if (!querySelector) {
              throw new Error("no query selector found");
            }
            console.log(`document.querySelector("${querySelector}")`);
            const clickActionResponse = await takeClickAction({
              querySelector,
              cursorOpts,
              elementRect: action.elementRect,
            });
            runnable = clickActionResponse.runnable;
            break;

          case "input":
            setThinkingState({ type: "clicking_button" });
            querySelector = getQuerySelectorFromIndex({
              minifiedElements,
              idx: action.idx,
            });
            if (!querySelector) {
              throw new Error("no query selector found");
            }
            console.log(`document.querySelector("${querySelector}")`);
            const inputActionResponse = await takeInputAction({
              querySelector,
              content: action.content,
              withSubmit: action.withSubmit,
              cursorOpts,
              pageOpts,
            });
            runnable = inputActionResponse.runnable;
            break;

          case "refresh":
            const refreshActionResponse = await takeRefreshAction();
            runnable = refreshActionResponse.runnable;
            break;

          case "back":
            const backActionResponse = await takeBackAction();
            runnable = backActionResponse.runnable;
            break;

          case "done":
            runnable = undefined;
            await clearState(action.explanation);
            setThinkingState({ type: "done" });
            runInProgress = false;
            break;

          default:
            toast.error("unknown action");
            break;
        }

        /**
         * check if the user takes over
         * if so, abort current action, re-evaluate next action
         */
        if (checkTakeOverRef.current) {
          const takeOver = takeOverRef.current;
          const setTakeOverState = setTakeOverStateRef.current;
          if (setTakeOverState) {
            setTakeOverState(TakeOverState.IN_PROGRESS);
          }
          if (takeOver) {
            cursorOpts.setCursorPosition({
              x: window.innerWidth * 0.6,
              y: window.innerHeight * 0.75,
            });
            await takeOver();
          }
          break;
        }

        /**
         * we do this because a "runnable" has the chance to navigate out of the page
         * resetting the execution context. if there is any cleanup to be done, it should
         * be right before this action.
         */
        if (runnable) {
          let userClarification = "";
          const res = await runnable();
          if (res?.userClarification) {
            userClarification = res.userClarification;
          }
          await appendHistory({
            step: updatedState.step,
            action: {
              action,
              querySelector: "",
              summary: await summarizeAction({
                action,
                userInput: userClarification,
              }),
              state: ActionState.IN_PROGRESS,
            },
          });
          incrStep();
        } // endfor

        await sleep(500);
      }
    } // endwhile

    if (i === MAX_RUN_STEPS) {
      setThinkingState({ type: "require_assistance" });
    }
  } catch (err) {
    const errorMessage = err as string;
    await errorState(errorMessage);
    setThinkingState({ type: "error", errorMessage });
  }
}

function getQuerySelectorFromIndex({
  minifiedElements,
  idx,
}: {
  minifiedElements: MinifiedElement[];
  idx: number;
}) {
  const querySelector = minifiedElements.find((el) => el.idx === idx)?.meta
    ?.querySelector;
  if (IS_DEBUGGING) {
    console.log(`document.querySelector("${querySelector}")`);
  }

  return querySelector;
}

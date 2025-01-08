import { StateMachineInput } from "@rive-app/react-canvas";
import { CursorCoordinate } from "@src/pages/majordomo/provider";
import { toast } from "sonner";

import { ExtensionState } from "../interface/state";
import { ThinkingState } from "../interface/thinking-state";
import { sleep } from "../utils";
import {
  generateAction,
  takeBackAction,
  takeClickAction,
  takeInputAction,
  takeNavigateAction,
  takeRefreshAction,
  takeScreenshot,
} from "./actions";
import { HistoryManager } from "./history-manager";

const MAX_RUN_STEPS = 10;

export async function runUntilCompletion({
  extensionState,
  historyManager,
  opts,
}: {
  extensionState: ExtensionState;
  historyManager: HistoryManager;
  opts: {
    clearState: () => Promise<void>;
    setThinkingState: React.Dispatch<React.SetStateAction<ThinkingState>>;
    clickAction: StateMachineInput | null;
    updateCursorPosition: (coord: CursorCoordinate) => Promise<void>;
    setCursorPosition: React.Dispatch<React.SetStateAction<CursorCoordinate>>;
    setCursorPositionEstimate: React.Dispatch<
      React.SetStateAction<CursorCoordinate>
    >;
  };
}) {
  const { userIntent } = extensionState;
  const {
    clearState,
    setThinkingState,
    clickAction,
    updateCursorPosition,
    setCursorPosition,
    setCursorPositionEstimate,
  } = opts;

  try {
    let i = 0;
    let runInProgress = true;
    while (i < MAX_RUN_STEPS && runInProgress) {
      i += 1;
      setThinkingState({ type: "awaiting_ui_changes" });
      await sleep(1500);

      const { ok, screenshot } = await takeScreenshot();
      if (!ok) {
        toast.error(
          "unable to take screenshot - please adjust your screen size and try again",
        );
        await clearState();
        setThinkingState({ type: "aborted" });
        runInProgress = false; // extra redundancy
        break;
      }

      setThinkingState({ type: "deciding_action" });
      const { action } = await generateAction({
        screenshot,
        userIntent,
        history: historyManager.getLocalHistory(),
      });
      if (!action) {
        toast.error("no action was chosen");
        continue;
      }

      console.log(action);

      setThinkingState({ type: "action", action });
      switch (action.type) {
        case "navigate":
          await takeNavigateAction({
            url: action.url,
            action,
            historyManager,
          });
          break;

        case "click":
          await takeClickAction({
            agentIntent: `aria-label: ${action.ariaLabel}, description: ${action.targetDescription}`,
            action,
            historyManager,
            opts: {
              setThinkingState,
              clickAction,
              updateCursorPosition,
              setCursorPosition,
              setCursorPositionEstimate,
            },
          });
          break;

        case "input":
          await takeInputAction({
            inputDescription: `aria-label: ${action.ariaLabel}, description: ${action.targetDescription}`,
            content: action.content,
            action,
            historyManager,
            opts: {
              setThinkingState,
              clickAction,
              updateCursorPosition,
              setCursorPosition,
              setCursorPositionEstimate,
            },
          });
          break;

        case "refresh":
          takeRefreshAction();
          break;

        case "back":
          takeBackAction();
          break;

        case "done":
          // @TODO insert some done animation
          await clearState();
          setThinkingState({ type: "done" });
          runInProgress = false;
          break;

        default:
          toast.error("unknown action");
          break;
      }
    } // endwhile

    if (i === MAX_RUN_STEPS) {
      setThinkingState({ type: "require_assistance" });
    }
  } catch (err) {
    console.error("runUntilCompletion:", err);
  }
}

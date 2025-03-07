import { MinifiedElement, PageOpts } from "@repo/types";
import { CursorCoordinate } from "@src/pages/majordomo/provider";
import { MutableRefObject } from "react";
import { toast } from "sonner";

import { chooseActionAndQuerySelector } from "../ai/api/choose-action-and-query-selector";
import { ActionMetadata } from "../interface/action-metadata";
import { sleep } from "../utils";
import { fillInput } from "./keyboard";

export async function generateAction({
  userIntent,
  minifiedElements,
  history,
  pageOpts,
}: {
  userIntent: string;
  minifiedElements: MinifiedElement[];
  history: ActionMetadata[][];
  pageOpts: PageOpts;
}) {
  const actionStep = await chooseActionAndQuerySelector({
    userIntent,
    minifiedElements,
    history,
    pageOpts,
  });

  return actionStep;
}

/**
 * only available via background script
 */
export async function takeScreenshot() {
  const res = await new Promise<{
    ok: boolean;
    screenshot: string;
  }>((resolve) => {
    const extensionElement = document.getElementById("majordomo");
    if (extensionElement) {
      extensionElement.classList.add("hidden");
    }

    chrome.runtime.sendMessage({ action: "screenshot" }, (response) => {
      if (extensionElement) {
        extensionElement.classList.remove("hidden");
      }
      resolve(response);
    });
  });

  return res;
}

/**
 * only available via background script
 */
export async function takeNavigateAction({ url }: { url: string }) {
  await sleep(500); // show navigation status
  const runnable = async () => {
    await new Promise<void>((resolve) => {
      chrome.runtime.sendMessage({ action: "navigate", url }, resolve);
    });
  };

  return { runnable };
}

export async function takeClarifyAction({
  clarifyInputRef,
  overlayBlurRef,
}: {
  clarifyInputRef: MutableRefObject<(() => Promise<string>) | null>;
  overlayBlurRef: MutableRefObject<((blur: boolean) => void) | null>;
}) {
  const runnable = async () => {
    const clarifyInput = clarifyInputRef.current;
    const overlayBlur = overlayBlurRef.current;
    if (clarifyInput) {
      if (overlayBlur) {
        overlayBlur(true);
      }
      const userClarification = await clarifyInput();
      if (overlayBlur) {
        overlayBlur(false);
      }
      return { userClarification };
    }
    return null;
  };

  return { runnable };
}

export async function takeClickAction({
  querySelector,
  cursorOpts,
  elementRect,
}: {
  querySelector: string;
  cursorOpts: {
    performClickRef: MutableRefObject<(() => void) | null>;
    updateCursorPosition: (coord: CursorCoordinate) => Promise<void>;
    setCursorPosition: React.Dispatch<React.SetStateAction<CursorCoordinate>>;
  };
  elementRect?: DOMRect;
}): Promise<{
  runnable?: (() => Promise<any>) | undefined;
}> {
  const runnable = async () => {
    await moveToElement({ querySelector, cursorOpts, elementRect });
  };

  return { runnable };
}

export async function takeInputAction({
  querySelector,
  content,
  withSubmit,
  cursorOpts,
  pageOpts,
}: {
  querySelector: string;
  content: string;
  withSubmit: boolean;
  cursorOpts: {
    performClickRef: MutableRefObject<(() => void) | null>;
    updateCursorPosition: (coord: CursorCoordinate) => Promise<void>;
    setCursorPosition: React.Dispatch<React.SetStateAction<CursorCoordinate>>;
  };
  pageOpts: PageOpts;
}): Promise<{
  runnable?: (() => Promise<void>) | undefined;
}> {
  const runnable = async () => {
    const { element } = await moveToElement({ querySelector, cursorOpts });
    if (!element) {
      toast.error("unable to move to element");
    }

    const inputElement = element as HTMLElement;
    await fillInput({ input: inputElement, content });
    if (pageOpts.useWithSubmit && withSubmit) {
      await sleep(1000);
      inputElement.closest("form")?.submit();
    }
  };

  return { runnable };
}

export async function takeRefreshAction() {
  const runnable = async () => {
    await new Promise<void>((resolve) => {
      chrome.runtime.sendMessage({ action: "refresh" }, resolve);
    });
  };

  return { runnable };
}

export async function takeBackAction() {
  const runnable = async () => {
    await new Promise<void>((resolve) => {
      chrome.runtime.sendMessage({ action: "back" }, resolve);
    });
  };

  return { runnable };
}

async function moveToElement({
  querySelector,
  cursorOpts,
  elementRect,
}: {
  querySelector: string;
  cursorOpts: {
    performClickRef: MutableRefObject<(() => void) | null>;
    updateCursorPosition: (coord: CursorCoordinate) => Promise<void>;
    setCursorPosition: React.Dispatch<React.SetStateAction<CursorCoordinate>>;
  };
  elementRect?: DOMRect;
}): Promise<{ ok: boolean; element: Element | null }> {
  try {
    const target = document.querySelector(querySelector);
    if (!target) {
      toast.error(`unable to find: ${querySelector}`);
      return { ok: false, element: null };
    }

    const targetRect = target.getBoundingClientRect();

    const rect = elementRect ?? targetRect;
    let centerX;
    let centerY;

    if (elementRect) {
      centerX = rect.x + rect.width / 2;
      centerY = rect.y + rect.height / 2;
    } else {
      centerX = targetRect.left + targetRect.width / 2;
      centerY = targetRect.top + targetRect.height / 2;
    }

    let newCoords: CursorCoordinate = { x: 0, y: 0 };

    let timeoutId: NodeJS.Timeout | undefined;
    let intervalId: NodeJS.Timeout | undefined;
    await new Promise<void>((resolve) => {
      const intervalId = setInterval(async () => {
        cursorOpts.setCursorPosition((prev) => {
          const newX = prev.x + (centerX - prev.x) * 0.3;
          const newY = prev.y + (centerY - prev.y) * 0.3;

          if (Math.abs(newX - centerX) < 1 && Math.abs(newY - centerY) < 1) {
            clearInterval(intervalId);

            timeoutId = setTimeout(async () => {
              const mouseoverEvent = new MouseEvent("mouseover", {
                bubbles: true,
                cancelable: true,
                view: window,
                clientX: centerX,
                clientY: centerY,
              });
              target.dispatchEvent(mouseoverEvent);
              await sleep(500);

              const performClick = cursorOpts.performClickRef.current;
              if (performClick) {
                performClick();
                await sleep(500);
              }
              const events = ["mousedown", "mouseup", "click"];
              events.forEach((eventType) => {
                const event = new MouseEvent(eventType, {
                  bubbles: true,
                  cancelable: true,
                  view: window,
                  clientX: centerX,
                  clientY: centerY,
                });
                target.dispatchEvent(event);
              });
              (target as HTMLElement).click();

              resolve(); // this ends the await
            }, 500);
          }

          newCoords = { x: newX, y: newY };
          return newCoords;
        });
      }, 16);
    });

    const cleanup = () => {
      if (intervalId) clearInterval(intervalId);
      if (timeoutId) clearTimeout(timeoutId);
    };
    window.addEventListener("error", cleanup);

    return { ok: true, element: target };
  } catch (err) {
    console.log(`selector: ${querySelector}, error: ${err}`);
    return { ok: false, element: null };
  }
}

export function printHistory(history: ActionMetadata[]) {
  console.log("---------\n");
  for (const h of history) {
    console.log(`${h.summary}, ${h.querySelector}`);
  }
}

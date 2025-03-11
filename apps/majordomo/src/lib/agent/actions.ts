import { MinifiedElement, PageOpts } from "@repo/types";
import { CursorCoordinate } from "@src/pages/majordomo/provider";
import { MutableRefObject } from "react";
import { toast } from "sonner";

import {
  chooseActionAndQuerySelector,
  chooseActionWithScreenshot,
} from "../ai/api/choose-action-and-query-selector";
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
  // const actionStep = await chooseActionAndQuerySelector({
  //   userIntent,
  //   minifiedElements,
  //   history,
  //   pageOpts,
  // });
  const actionStep = await chooseActionWithScreenshot({
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
      intervalId = setInterval(async () => {
        cursorOpts.setCursorPosition((prev) => {
          const newX = prev.x + (centerX - prev.x) * 0.3;
          const newY = prev.y + (centerY - prev.y) * 0.3;

          if (Math.abs(newX - centerX) < 1 && Math.abs(newY - centerY) < 1) {
            clearInterval(intervalId);

            timeoutId = setTimeout(async () => {
              // First, trigger mouseover to simulate hover
              const mouseoverEvent = new MouseEvent("mouseover", {
                bubbles: true,
                cancelable: true,
                view: window,
                clientX: centerX,
                clientY: centerY,
              });
              target.dispatchEvent(mouseoverEvent);
              await sleep(500);

              // Use the performClick if available (animation)
              const performClick = cursorOpts.performClickRef.current;
              if (performClick) {
                performClick();
                await sleep(500);
              }

              try {
                // Enhanced click methods with more realistic event properties

                // Method 1: More realistic synthetic events with additional properties
                const createMouseEvent = (type: string) => {
                  // Create a more complete mouse event with additional properties
                  const event = new MouseEvent(type, {
                    bubbles: true,
                    cancelable: true,
                    view: window,
                    detail: 1, // Click count
                    clientX: centerX,
                    clientY: centerY,
                    screenX: centerX,
                    screenY: centerY,
                    ctrlKey: false,
                    altKey: false,
                    shiftKey: false,
                    metaKey: false,
                    button: 0, // Primary button (left)
                    buttons: 1, // Primary button pressed
                    relatedTarget: null,
                  });

                  // Remove isTrusted property setting - cannot modify this
                  return event;
                };

                // Dispatch events in the correct sequence with proper timing
                target.dispatchEvent(createMouseEvent("mouseenter"));
                await sleep(50);
                target.dispatchEvent(createMouseEvent("mouseover"));
                await sleep(50);
                target.dispatchEvent(createMouseEvent("mousedown"));
                await sleep(50);
                target.dispatchEvent(createMouseEvent("mouseup"));
                await sleep(50);
                target.dispatchEvent(createMouseEvent("click"));
                console.log("Enhanced synthetic events executed");

                // Method 2: Direct click with focus first
                if (target instanceof HTMLElement) {
                  target.focus();
                  await sleep(100);
                  target.click();
                  console.log("Direct click with focus executed");
                }

                // Method 3: Try clicking parent elements too (for event delegation)
                if (target.parentElement) {
                  console.log("Trying parent element click");
                  if (target.parentElement instanceof HTMLElement) {
                    target.parentElement.click();
                  }
                }

                // Method 4: Try to trigger any onclick attribute directly
                if (
                  target instanceof HTMLElement &&
                  target.hasAttribute("onclick")
                ) {
                  console.log("Executing onclick attribute directly");
                  const onclickAttr = target.getAttribute("onclick");
                  if (onclickAttr) {
                    try {
                      new Function(onclickAttr).call(target);
                    } catch (e) {
                      console.error("Error executing onclick attribute:", e);
                    }
                  }
                }

                // Method 5: Look for common dialog trigger patterns
                if (target instanceof HTMLElement) {
                  // Check for aria attributes that might indicate a dialog trigger
                  if (
                    target.hasAttribute("aria-haspopup") ||
                    target.hasAttribute("aria-controls") ||
                    target.getAttribute("role") === "button"
                  ) {
                    console.log(
                      "Dialog trigger element detected, trying special handling",
                    );
                    // Try keyboard event (Space/Enter often triggers buttons)
                    ["keydown", "keypress", "keyup"].forEach((eventType) => {
                      const keyEvent = new KeyboardEvent(eventType, {
                        bubbles: true,
                        cancelable: true,
                        key: "Enter",
                        code: "Enter",
                        keyCode: 13,
                        which: 13,
                      });
                      target.dispatchEvent(keyEvent);
                    });
                  }
                }

                // Method 6: Try simulating a more natural click sequence
                try {
                  console.log("Attempting more natural click sequence");
                  // Try a more natural sequence with delays
                  if (target instanceof HTMLElement) {
                    // First hover
                    target.dispatchEvent(
                      new MouseEvent("mouseover", { bubbles: true }),
                    );
                    await sleep(100);

                    // Then focus if focusable
                    if (
                      target.tagName === "BUTTON" ||
                      target.tagName === "A" ||
                      target.tagName === "INPUT" ||
                      target.hasAttribute("tabindex")
                    ) {
                      target.focus();
                      await sleep(100);
                    }

                    // Then mousedown-mouseup-click in quick succession
                    target.dispatchEvent(
                      new MouseEvent("mousedown", { bubbles: true }),
                    );
                    await sleep(50);
                    target.dispatchEvent(
                      new MouseEvent("mouseup", { bubbles: true }),
                    );
                    await sleep(10);
                    target.click();

                    // If it's a form element, try submit
                    const form = target.closest("form");
                    if (form && target.getAttribute("type") === "submit") {
                      await sleep(100);
                      form.submit();
                    }
                  }
                } catch (e) {
                  console.error("Error in natural click sequence:", e);
                }

                // Method 7: Try using PointerEvents which are more modern
                try {
                  console.log("Attempting pointer events sequence");
                  if (target instanceof HTMLElement) {
                    // PointerEvents are more modern and might work better on some sites
                    const pointerEvents = [
                      "pointerover",
                      "pointerenter",
                      "pointerdown",
                      "pointerup",
                      "pointercancel",
                    ];
                    for (const eventType of pointerEvents) {
                      const event = new PointerEvent(eventType, {
                        bubbles: true,
                        cancelable: true,
                        view: window,
                        clientX: centerX,
                        clientY: centerY,
                        pointerId: 1,
                        pointerType: "mouse",
                      });
                      target.dispatchEvent(event);
                      await sleep(30);
                    }
                    // Follow with a click
                    target.click();
                  }
                } catch (e) {
                  console.error("Error in pointer events sequence:", e);
                }

                // Method 8: Check if element is in Shadow DOM and try to handle that
                try {
                  console.log("Checking for Shadow DOM");
                  // If the element is in a shadow DOM, we might need special handling
                  let shadowRoot = null;
                  let currentElement: Element | null = target;

                  // Walk up the DOM tree to find shadow roots
                  while (currentElement && !shadowRoot) {
                    if (currentElement.shadowRoot) {
                      shadowRoot = currentElement.shadowRoot;
                      console.log(
                        "Found shadow root, trying to click within shadow DOM",
                      );

                      // Try to find the actual element in the shadow DOM
                      const shadowTarget = shadowRoot.elementFromPoint(
                        centerX,
                        centerY,
                      );
                      if (shadowTarget && shadowTarget instanceof HTMLElement) {
                        console.log("Found element in shadow DOM, clicking it");
                        shadowTarget.click();
                      }
                    }
                    currentElement = currentElement.parentElement;
                  }
                } catch (e) {
                  console.error("Error handling shadow DOM:", e);
                }

                // Method 9: Try to find any clickable parent
                try {
                  console.log("Trying to find any clickable parent");
                  let currentElement: Element | null = target;
                  let depth = 0;
                  const maxDepth = 5; // Don't go too far up the tree

                  while (currentElement && depth < maxDepth) {
                    if (currentElement instanceof HTMLElement) {
                      // Check if this element has click-related attributes or styles
                      const style = window.getComputedStyle(currentElement);
                      const isClickable =
                        currentElement.tagName === "BUTTON" ||
                        currentElement.tagName === "A" ||
                        currentElement.tagName === "INPUT" ||
                        currentElement.hasAttribute("onclick") ||
                        currentElement.getAttribute("role") === "button" ||
                        style.cursor === "pointer" ||
                        currentElement.hasAttribute("tabindex");

                      if (isClickable) {
                        console.log(
                          "Found clickable parent, trying to click it",
                        );
                        currentElement.click();
                        break;
                      }
                    }
                    currentElement = currentElement.parentElement;
                    depth++;
                  }
                } catch (e) {
                  console.error("Error finding clickable parent:", e);
                }

                // Method 10: Try to programmatically trigger the dialog
                try {
                  console.log("Trying to programmatically trigger dialog");
                  // Look for dialog elements that might be controlled by this element
                  if (target instanceof HTMLElement) {
                    // Check for aria-controls attribute
                    const controlsId = target.getAttribute("aria-controls");
                    if (controlsId) {
                      const dialogElement = document.getElementById(controlsId);
                      if (dialogElement) {
                        console.log(
                          "Found dialog element via aria-controls, showing it",
                        );
                        if (dialogElement instanceof HTMLDialogElement) {
                          dialogElement.showModal();
                        } else {
                          // Try to set display style
                          dialogElement.style.display = "block";
                        }
                      }
                    }

                    // Check for data attributes that might control a dialog
                    const dataAttributes = Array.from(target.attributes)
                      .filter((attr) => attr.name.startsWith("data-"))
                      .map((attr) => ({ name: attr.name, value: attr.value }));

                    for (const { name, value } of dataAttributes) {
                      if (
                        name.includes("toggle") ||
                        name.includes("target") ||
                        name.includes("open")
                      ) {
                        const possibleDialog =
                          document.getElementById(value) ||
                          document.querySelector(value);
                        if (possibleDialog) {
                          console.log(
                            `Found possible dialog via ${name}, showing it`,
                          );
                          if (possibleDialog instanceof HTMLDialogElement) {
                            possibleDialog.showModal();
                          } else {
                            possibleDialog.style.display = "block";
                          }
                        }
                      }
                    }
                  }
                } catch (e) {
                  console.error(
                    "Error trying to programmatically trigger dialog:",
                    e,
                  );
                }

                // Method 11: Debug element and try a more targeted approach
                try {
                  console.log("Debugging element properties");
                  if (target instanceof HTMLElement) {
                    // Log detailed information about the element
                    console.log("Element tag:", target.tagName);
                    console.log("Element id:", target.id);
                    console.log("Element classes:", target.className);
                    console.log(
                      "Element attributes:",
                      Array.from(target.attributes)
                        .map((a) => `${a.name}=${a.value}`)
                        .join(", "),
                    );

                    // Check computed style for cursor
                    const style = window.getComputedStyle(target);
                    console.log("Element cursor style:", style.cursor);
                    console.log("Element pointer-events:", style.pointerEvents);

                    // Check if element has any event listeners (indirect check)
                    const hasOnClickAttr = target.hasAttribute("onclick");
                    const hasHref = target.hasAttribute("href");
                    const isButton =
                      target.tagName === "BUTTON" ||
                      target.getAttribute("role") === "button";
                    console.log("Has onclick:", hasOnClickAttr);
                    console.log("Has href:", hasHref);
                    console.log("Is button:", isButton);

                    // Try a more forceful approach - dispatch event directly to document
                    console.log(
                      "Trying document-level click event at element coordinates",
                    );
                    const rect = target.getBoundingClientRect();
                    const x = rect.left + rect.width / 2;
                    const y = rect.top + rect.height / 2;

                    // Create and dispatch a MouseEvent at the document level
                    const documentClickEvent = new MouseEvent("click", {
                      bubbles: true,
                      cancelable: true,
                      view: window,
                      clientX: x,
                      clientY: y,
                      screenX: x,
                      screenY: y,
                    });
                    document.dispatchEvent(documentClickEvent);

                    // Try to find any dialog elements that appeared after our attempts
                    await sleep(500);
                    const dialogs = document.querySelectorAll(
                      'dialog[open], [role="dialog"], [aria-modal="true"]',
                    );
                    console.log("Found dialog elements:", dialogs.length);

                    // If we found dialogs, try to interact with them
                    if (dialogs.length > 0) {
                      console.log(
                        "Dialog found, attempting to interact with it",
                      );
                      dialogs.forEach((dialog) => {
                        if (dialog instanceof HTMLElement) {
                          // Make sure it's visible
                          dialog.style.display = "block";
                          if (
                            dialog instanceof HTMLDialogElement &&
                            !dialog.open
                          ) {
                            dialog.showModal();
                          }
                        }
                      });
                    }

                    // Try using keyboard shortcut that might trigger the dialog
                    console.log("Trying keyboard shortcuts");
                    ["Enter", "Space", "Escape"].forEach((key) => {
                      window.dispatchEvent(
                        new KeyboardEvent("keydown", { key }),
                      );
                      window.dispatchEvent(new KeyboardEvent("keyup", { key }));
                    });

                    // Method 13: Site-specific handling for Uber Eats
                    try {
                      console.log(
                        "Trying site-specific handling for Uber Eats",
                      );

                      // Check if we're on Uber Eats
                      const isUberEats =
                        window.location.hostname.includes("ubereats.com");
                      if (isUberEats) {
                        console.log(
                          "Detected Uber Eats site, applying special handling",
                        );

                        // For Uber Eats, try to find and click all possible clickable elements inside the target
                        const clickableSelectors = [
                          "a",
                          "button",
                          '[role="button"]',
                          '[tabindex="0"]',
                          '[data-test="store-item"]',
                          "[data-testid]", // Any element with data-testid
                          "div.store-item",
                          ".store-tile",
                          ".item-card",
                        ];

                        // First try children
                        let clickableElements: HTMLElement[] = [];

                        // Add all direct children that match our selectors
                        clickableSelectors.forEach((selector) => {
                          const elements = target.querySelectorAll(selector);
                          elements.forEach((el) => {
                            if (el instanceof HTMLElement) {
                              clickableElements.push(el);
                            }
                          });
                        });

                        // If no children found, check if any parent elements match
                        if (clickableElements.length === 0) {
                          let parent = target.parentElement;
                          let depth = 0;
                          while (parent && depth < 3) {
                            // Check up to 3 levels up
                            clickableSelectors.forEach((selector) => {
                              if (parent && parent.matches(selector)) {
                                clickableElements.push(parent as HTMLElement);
                              }
                            });
                            parent = parent.parentElement;
                            depth++;
                          }
                        }

                        // If still no elements found, try siblings
                        if (
                          clickableElements.length === 0 &&
                          target.parentElement
                        ) {
                          const siblings = target.parentElement.children;
                          for (let i = 0; i < siblings.length; i++) {
                            const sibling = siblings[i];
                            if (
                              sibling instanceof HTMLElement &&
                              sibling !== target
                            ) {
                              clickableSelectors.forEach((selector) => {
                                if (sibling.matches(selector)) {
                                  clickableElements.push(sibling);
                                }
                              });
                            }
                          }
                        }

                        // Try clicking each element we found
                        console.log(
                          `Found ${clickableElements.length} potential clickable elements`,
                        );
                        for (const element of clickableElements) {
                          console.log(
                            "Clicking potential element:",
                            element.tagName,
                            element.className,
                          );
                          element.click();
                          await sleep(100);
                        }

                        // If we still haven't found anything, try a more aggressive approach
                        if (clickableElements.length === 0) {
                          console.log(
                            "No clickable elements found, trying more aggressive approach",
                          );

                          // Try to find any element with a pointer cursor
                          const allElements = document.elementsFromPoint(x, y);
                          for (const element of allElements) {
                            if (element instanceof HTMLElement) {
                              const style = window.getComputedStyle(element);
                              if (style.cursor === "pointer") {
                                console.log(
                                  "Found element with pointer cursor:",
                                  element.tagName,
                                  element.className,
                                );
                                element.click();
                                await sleep(100);
                              }
                            }
                          }

                          // Try clicking at exact coordinates using elementFromPoint
                          const elementAtPoint = document.elementFromPoint(
                            x,
                            y,
                          );
                          if (
                            elementAtPoint &&
                            elementAtPoint instanceof HTMLElement
                          ) {
                            console.log(
                              "Clicking element at exact coordinates:",
                              elementAtPoint.tagName,
                              elementAtPoint.className,
                            );
                            elementAtPoint.click();
                          }
                        }
                      }
                    } catch (e) {
                      console.error("Error in site-specific handling:", e);
                    }
                  }
                } catch (e) {
                  console.error("Error in debugging and targeted approach:", e);
                }

                // Method 12: Last resort - try to simulate a real user click via browser API
                try {
                  console.log("Attempting to use browser API for clicking");
                  // This is a message to the extension's background script
                  // You'll need to implement this in your background.js
                  if (window.chrome && chrome.runtime) {
                    chrome.runtime.sendMessage({
                      action: "simulateRealClick",
                      x: centerX,
                      y: centerY,
                      selector: querySelector,
                    });
                    console.log(
                      "Sent click simulation request to background script",
                    );
                  }
                } catch (e) {
                  console.error(
                    "Error sending message to background script:",
                    e,
                  );
                }
              } catch (clickErr) {
                console.error("Error during click execution:", clickErr);
              }

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
    // Also clean up on success
    cleanup();

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

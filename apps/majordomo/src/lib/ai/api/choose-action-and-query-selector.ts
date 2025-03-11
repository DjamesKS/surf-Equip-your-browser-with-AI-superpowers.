import { chooseActionAndQuerySelectorResponseSchema } from "@repo/ai-schemas";
import { MinifiedElement, PageOpts } from "@repo/types";
import { SERVER_URL } from "@src/lib/env";
import { Action } from "@src/lib/interface/action";
import { ActionMetadata } from "@src/lib/interface/action-metadata";
import { z } from "zod";

export async function chooseActionAndQuerySelector({
  userIntent,
  minifiedElements,
  history,
  pageOpts,
  screenshot,
}: {
  userIntent: string;
  minifiedElements: MinifiedElement[];
  history: ActionMetadata[][];
  pageOpts: PageOpts;
  screenshot?: string;
}): Promise<Action[]> {
  try {
    const requestData = {
      userIntent,
      hostname: pageOpts.hostname,
      htmlDom: JSON.stringify(minifiedElements),
      history: JSON.stringify(history),
      screenshot,
    };

    console.log("Request data:", {
      userIntent,
      hostname: pageOpts.hostname,
      htmlDomLength: requestData.htmlDom.length,
      historyLength: requestData.history.length,
      hasScreenshot: !!screenshot,
    });

    const res = await fetch(
      `${SERVER_URL}/api/choose-action-and-query-selector`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(requestData),
      },
    );
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`non-2xx http status: ${res.status}, ${errorText}`);
    }

    const data = (await res.json()) as z.infer<
      typeof chooseActionAndQuerySelectorResponseSchema
    >;
    return data.actions as Action[];
  } catch (err) {
    console.error("chooseAction:", err);
    return [];
  }
}

async function captureScreenshotViaBackground(): Promise<string> {
  return new Promise((resolve, reject) => {
    console.log("Content script requesting screenshot from background");

    chrome.runtime.sendMessage({ action: "captureScreenshot" }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      if (response && response.screenshot) {
        console.log("Content script received screenshot from background");
        resolve(response.screenshot);
      } else {
        reject(new Error(response?.error || "Failed to capture screenshot"));
      }
    });
  });
}

export async function chooseActionWithScreenshot({
  userIntent,
  minifiedElements,
  history,
  pageOpts,
}: {
  userIntent: string;
  minifiedElements: MinifiedElement[];
  history: ActionMetadata[][];
  pageOpts: PageOpts;
}): Promise<Action[]> {
  try {
    // Try to capture screenshot via background script
    let screenshot: string | undefined;

    try {
      screenshot = await captureScreenshotViaBackground();
      console.log("Screenshot captured successfully");
    } catch (error) {
      console.error("Error capturing screenshot:", error);
      // Continue without screenshot
    }

    // Call chooseActionAndQuerySelector with the screenshot if available
    return await chooseActionAndQuerySelector({
      userIntent,
      minifiedElements,
      history,
      pageOpts,
      screenshot,
    });
  } catch (error) {
    console.error("Error in chooseActionWithScreenshot:", error);
    // Fallback to no screenshot
    return await chooseActionAndQuerySelector({
      userIntent,
      minifiedElements,
      history,
      pageOpts,
    });
  }
}

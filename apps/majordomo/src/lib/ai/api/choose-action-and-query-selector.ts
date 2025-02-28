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
}: {
  userIntent: string;
  minifiedElements: MinifiedElement[];
  history: ActionMetadata[][];
  pageOpts: PageOpts;
}): Promise<Action[]> {
  try {
    const requestData = {
      userIntent,
      hostname: pageOpts.hostname,
      htmlDom: JSON.stringify(minifiedElements),
      history: JSON.stringify(history),
    };

    console.log("Request data:", {
      userIntent,
      hostname: pageOpts.hostname,
      htmlDomLength: requestData.htmlDom.length,
      historyLength: requestData.history.length,
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

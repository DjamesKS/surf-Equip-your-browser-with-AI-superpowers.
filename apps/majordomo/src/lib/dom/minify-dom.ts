import { MinifiedElement } from "@repo/types/element";

import { INCLUDE_ID_IN_QUERY_SELECTOR } from "../env";

export function minifyDom(document: HTMLElement): MinifiedElement[] {
  const minifiedDom: MinifiedElement[] = [];
  const existingElements = new Set<string>();

  const elements = Array.from(document.querySelectorAll("*")).concat(
    Array.from(document.querySelectorAll("iframe")).flatMap((iframe) =>
      Array.from(iframe.contentDocument?.querySelectorAll("*") || []),
    ),
  );

  elements.forEach((el, idx) => {
    const title = el.getAttribute("title");
    if (title === "credit card number") {
      console.log("found credit card number!");
    }
    const role = el.getAttribute("role");
    const type = el.getAttribute("type");
    if (role === "style" || role === "script" || role === "main") return;
    if (
      role === "grid" ||
      role === "table" ||
      role === "contentinfo" ||
      role === "complementary" ||
      role === "banner" ||
      role === "navigation" ||
      role === "tabpanel"
    )
      return;

    const rect = el.getBoundingClientRect();
    if (rect.height === 0 || rect.width === 0) {
      return;
    }

    const tag = (role || type || "div") as string;
    const MAX_TOPIC_LEN = 100;
    let topic = (
      el.getAttribute("aria-label") ||
      el.getAttribute("title") ||
      (el.textContent?.replace(/\s/g, "") as string)
    ).substring(0, MAX_TOPIC_LEN);
    if (title === "credit card number") {
      console.log("credit card topic:", topic);
    }
    if (!topic) {
      return;
    }

    if (
      el.tagName.toLowerCase() === "input" ||
      el.tagName.toLowerCase() === "checkbox"
    ) {
      const checked = el.getAttribute("checked");
      if (checked) {
        topic += ` checked="${checked}"`;
      }
    }

    const key = `${tag}-${topic}`;
    if (existingElements.has(key)) {
      return;
    }
    existingElements.add(key);

    const newElement: MinifiedElement = {
      tag,
      topic,
      idx,
      meta: {
        querySelector: getQuerySelector(el),
      },
    };
    minifiedDom.push(newElement);
  });

  return minifiedDom;
}

function getQuerySelector(el: Element): string {
  const path: string[] = [];
  let current = el;

  while (current && current !== document.body) {
    let selector = current.tagName.toLowerCase();

    if (INCLUDE_ID_IN_QUERY_SELECTOR) {
      if (current.id) {
        // special case for ':' like in gmail
        if (current.id.includes(":")) {
          selector += `[id="${current.id}"]`;
        } else {
          // other special characters
          selector += `#${CSS.escape(current.id)}`;
        }
        path.unshift(selector);

        // ID is unique, stop here
        break;
      }
    }

    if (current.className) {
      try {
        const cleanedClasses = current.className
          .split(/[\s\n\r]+/) // split on whitespace
          .filter((c) => c)
          .map((className) => CSS.escape(className))
          .join(".");

        if (cleanedClasses) {
          selector += `.${cleanedClasses}`;
        }
      } catch (err) {}
    }

    path.unshift(selector);
    current = current.parentElement!;
  }

  return path.join(" > ");
}

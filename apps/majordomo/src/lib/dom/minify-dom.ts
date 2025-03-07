import { MinifiedElement, PageOpts } from "@repo/types";

export function minifyDom({
  document,
  pageOpts,
}: {
  document: HTMLElement;
  pageOpts: PageOpts;
}): MinifiedElement[] {
  const minifiedDom: MinifiedElement[] = [];
  const existingElements = new Set<string>();

  const elements = Array.from(document.querySelectorAll("*")).concat(
    Array.from(document.querySelectorAll("iframe")).flatMap((iframe) =>
      Array.from(iframe.contentDocument?.querySelectorAll("*") || []),
    ),
  );

  elements.forEach((el, idx) => {
    const role = el.getAttribute("role");
    if (
      role === "style" ||
      role === "script" ||
      role === "main" ||
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

    const type = el.getAttribute("type");
    const tag = (role || type || "div") as string;

    const MAX_TOPIC_LEN = 250;
    let topic = (
      el.getAttribute("href") ||
      el.getAttribute("aria-label") ||
      el.getAttribute("title") ||
      el.getAttribute("placeholder") ||
      el.getAttribute("data-testid") ||
      (el.textContent?.replace(/\s/g, "") as string)
    ).substring(0, MAX_TOPIC_LEN);
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

    const id = el.id;
    const key = `${tag}-${id}-${topic}`;
    if (existingElements.has(key)) {
      return;
    }
    existingElements.add(key);

    const htmlElement = JSON.stringify({
      tag: el.tagName,
      id: el.id?.length > 0 ? el.id : undefined,
      class: el.className?.length > 0 ? el.className : undefined,
      text:
        el.textContent && el.textContent.length > 0
          ? el.textContent.substring(0, MAX_TOPIC_LEN)
          : undefined,
      attributes: Array.from(el.attributes).map((attr) => ({
        name: attr.name,
        value: attr.value,
      })),
      rect: rect
        ? {
            width: rect.width,
            height: rect.height,
            top: rect.top,
            left: rect.left,
          }
        : undefined,
      role: el.getAttribute("role") ?? undefined,
      type: el.getAttribute("type") ?? undefined,
    });

    const newElement: MinifiedElement = {
      idx,
      meta: {
        querySelector: getQuerySelector(el, pageOpts.includeIdInQuerySelector),
      },
      htmlElement,
    };
    minifiedDom.push(newElement);
  });

  return minifiedDom;
}

function getQuerySelector(
  el: Element,
  includeIdInQuerySelector: boolean,
): string {
  const path: string[] = [];
  let current = el;

  while (current && current !== document.body) {
    let selector = current.tagName.toLowerCase();

    if (includeIdInQuerySelector) {
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

    if (current.parentElement) {
      const siblings = Array.from(current.parentElement.children);
      const sameTagSiblings = siblings.filter(
        (sibling) => sibling.tagName === current.tagName,
      );
      if (sameTagSiblings.length > 1) {
        const index = sameTagSiblings.indexOf(current) + 1;
        selector += `:nth-of-type(${index})`;
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

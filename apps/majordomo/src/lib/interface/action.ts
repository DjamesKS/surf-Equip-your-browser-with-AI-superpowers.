export type Action =
  | { type: "navigate"; url: string }
  | { type: "clarify"; question: string }
  | { type: "click"; idx: number; description: string; elementRect?: DOMRect }
  | {
      type: "input";
      idx: number;
      content: string;
      withSubmit: boolean;
    }
  | { type: "refresh" }
  | { type: "back" }
  | { type: "done"; explanation: string };

export function stringify(action: Action) {
  switch (action.type) {
    case "navigate":
      return `navigating to ${action.url}...`;
    case "clarify":
      return `${action.question}`;
    case "click":
      return `clicking "${action.description}" at ${action.elementRect?.x}, ${action.elementRect?.y}...`;
    case "input":
      return `typing ${action.content}...`;
    case "refresh":
      return "refreshing page";
    case "back":
      return "going back";
    case "done":
      return action.explanation;
  }
}

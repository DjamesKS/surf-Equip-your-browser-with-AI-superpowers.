export type MinifiedElement = {
  // tag: string;
  // id: string;
  // topic: string;
  idx: number;
  meta: {
    querySelector: string;
  };
  // rect: DOMRect;
  htmlElement: string;
};

export function minifiedElementToString(element: MinifiedElement) {
  // const { tag, id, topic, htmlElement, idx } = element;
  // return `<${tag} id="#${id}" topic="${topic}" element=${htmlElement} idx=${idx} />`;
  const { htmlElement, idx } = element;
  return `<${htmlElement} idx=${idx} />`;
}

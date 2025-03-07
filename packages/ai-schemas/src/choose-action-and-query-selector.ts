import { z } from "zod";

const navigateAction = z.object({
  type: z.literal("navigate"),
  url: z.string(),
});

const clarifyAction = z.object({
  type: z.literal("clarify"),
  question: z.string(),
});

const clickAction = z.object({
  type: z.literal("click"),
  idx: z.number(),
  description: z.string(),
  elementRect: z.object({
    x: z.number(),
    y: z.number(),
    width: z.number(),
    height: z.number(),
  }),
});

const inputAction = z.object({
  type: z.literal("input"),
  idx: z.number(),
  content: z.string(),
  withSubmit: z.boolean(),
});

const refreshAction = z.object({
  type: z.literal("refresh"),
});

const backAction = z.object({
  type: z.literal("back"),
});

const doneAction = z.object({
  type: z.literal("done"),
  explanation: z.string(),
});

export const chooseActionAndQuerySelectorResponseSchema = z.object({
  actions: z.array(
    z.discriminatedUnion("type", [
      navigateAction,
      clarifyAction,
      clickAction,
      inputAction,
      refreshAction,
      backAction,
      doneAction,
    ]),
  ),
});

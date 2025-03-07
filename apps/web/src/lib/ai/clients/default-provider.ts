import { claudeHaiku } from "./anthropic";
import { gemini2Flash } from "./google";
import { gpt4o, o3Mini } from "./openai";

// export const defaultProvider = claudeHaiku;

export const defaultProvider = gpt4o;
// export const defaultProvider = o3Mini;

// export const defaultProvider = gemini2Flash;

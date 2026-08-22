import type { ID, Timestamps } from "./common";

/** The 3 named advisor personas from the prototype: وینا / وین‌یاد / آروین. */
export type AdvisorPersonaKey = "viana" | "winyar" | "arvin";

export interface AdvisorPersona {
  id: ID;
  key: AdvisorPersonaKey;
  name: string;
  role: string;
  style: string;
  bestFor: string;
  focus: string;
  quote: string;
  traits: string[];
  avatarUrl: string;
  /** System prompt used when this persona is wired to a real LLM. Server-only. */
  systemPrompt: string;
}

export interface UserAdvisorPreference {
  userId: ID;
  selectedPersonaKey: AdvisorPersonaKey;
  voiceRepliesEnabled: boolean;
}

export type ChatMessageRole = "user" | "advisor";

export interface ChatMessage extends Timestamps {
  id: ID;
  userId: ID;
  personaKey: AdvisorPersonaKey;
  role: ChatMessageRole;
  /** True if the user's message came in via the mic (speech-to-text). */
  viaVoice: boolean;
  content: string;
}

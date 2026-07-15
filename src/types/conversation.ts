import type { ChatMessage } from "../services/tauri/commands";

export interface Conversation {
  id: string;
  /** Absolute path of the PDF this conversation belongs to. */
  pdfPath: string;
  /** Starts as "New conversation", replaced once the LLM title call resolves. */
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

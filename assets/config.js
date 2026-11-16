/**
 * Organic Chemistry Reaction Mechanism LLM Wiki & Learning Hub
 * assets/config.js — Chatbot Configuration
 * 
 * Rules:
 * - NEVER put API keys in any file in this repository.
 * - If an external LLM backend is added in the future, it is called ONLY
 *   through the proxy URL defined below.
 * - Mode A operates 100% locally in the browser via client-side RAG over wiki/*.md.
 */

const CHAT_CONFIG = {
  // Mode A: Local client-side wiki chunk retriever (default)
  mode: "A",
  
  // Mode B: Optional proxy URL (NO API keys here; keep empty for Mode A)
  proxyUrl: ""
};

/**
 * Central AI configuration.
 *
 * Keep the model ID and system prompt here — not inline in the route handler —
 * so future features (FE-07) can import and extend this without touching
 * request-handling logic.
 */

import { google } from '@ai-sdk/google';

/**
 * The Gemini model used for this app's chat interface.
 *
 * `gemini-3.5-flash-lite` is a current, stable, GA model — cheap and fast,
 * good fit for an interactive chat UI. Confirmed available via the
 * ListModels endpoint (not a preview/deprecated ID).
 *
 * NOTE: Google periodically retires older model IDs (this app previously
 * broke on `gemini-1.5-flash` and `gemini-2.5-flash`, both retired).
 * If this string ever 404s again, check the live model list at:
 * https://generativelanguage.googleapis.com/v1beta/models?key=YOUR_KEY
 * and swap the string here — nothing else in the app needs to change.
 */
export const CHAT_MODEL = google('gemini-3.5-flash-lite');

/**
 * System prompt — defines the assistant's role and behavior for every
 * conversation. Edit this single string to change the assistant's
 * personality/purpose app-wide.
 */
export const SYSTEM_PROMPT =
  "You are a helpful, knowledgeable coding assistant embedded in a chat app. " +
  "You help the user write, debug, explain, and improve code across languages and frameworks. " +
  "Be direct and practical: give working code, explain your reasoning briefly, and call out " +
  "edge cases, security issues, or better approaches when relevant. Use Markdown code blocks " +
  "with language tags for any code you share. If a request is ambiguous, make a reasonable " +
  "assumption and say what you assumed rather than just asking a clarifying question.";
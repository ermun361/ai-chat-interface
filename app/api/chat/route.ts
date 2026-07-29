import { streamText, convertToModelMessages, UIMessage } from 'ai';
import { CHAT_MODEL, SYSTEM_PROMPT } from '@/lib/ai/config';

// The Gemini API key is read server-side only, from process.env
// (GOOGLE_GENERATIVE_AI_API_KEY in .env.local). It is never sent to the
// client — the browser only ever talks to this route, never to Google directly.

export async function POST(req: Request) {
  try {
    const { messages }: { messages: UIMessage[] } = await req.json();

    const modelMessages = await convertToModelMessages(messages);

    const result = streamText({
      model: CHAT_MODEL,
      system: SYSTEM_PROMPT,
      messages: modelMessages,
    });

    // Streams back in the UIMessage/parts format the v5 useChat client expects.
    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error('AI_ERROR:', error);
    return new Response(JSON.stringify({ error: 'Check terminal' }), { status: 500 });
  }
}
import { google } from '@ai-sdk/google';
import { streamText, convertToModelMessages, UIMessage } from 'ai';

export async function POST(req: Request) {
  try {
    const { messages }: { messages: UIMessage[] } = await req.json();

    const modelMessages = await convertToModelMessages(messages);

    const result = streamText({
      model: google('gemini-3.5-flash-lite'),
      messages: modelMessages,
    });

    // v5: use toUIMessageStreamResponse (toDataStreamResponse is the old v4 API)
    return result.toUIMessageStreamResponse();
  } catch (error) {
    // This will print the real error in your terminal window
    console.error('AI_ERROR:', error);
    return new Response(JSON.stringify({ error: 'Check terminal' }), { status: 500 });
  }
}
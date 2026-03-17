import type { Config, Context } from "@netlify/functions";
import { GoogleGenAI } from "@google/genai";

export default async (req: Request, context: Context) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const { chatHistory, systemInstruction } = await req.json();

  const apiKey = Netlify.env.get("GEMINI_API_KEY");
  if (!apiKey) {
    return Response.json(
      { error: "GEMINI_API_KEY is not configured" },
      { status: 500 }
    );
  }

  const ai = new GoogleGenAI({ apiKey });

  const responseStream = await ai.models.generateContentStream({
    model: "gemini-2.5-flash",
    contents: chatHistory,
    config: {
      systemInstruction,
    },
  });

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      try {
        for await (const chunk of responseStream) {
          const text = chunk.text || "";
          if (text) {
            controller.enqueue(encoder.encode(text));
          }
        }
      } catch (err) {
        controller.enqueue(
          encoder.encode(`\n\n[ERROR]: ${(err as Error).message}`)
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
};

export const config: Config = {
  path: "/api/generate",
};

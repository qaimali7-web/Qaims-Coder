export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).send("Method not allowed");
    return;
  }

  const { chatHistory, systemInstruction, model = "stepfun/step-3.5-flash:free" } = req.body;

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "OPENROUTER_API_KEY environment variable is not configured." });
    return;
  }

  // Convert chat history to OpenRouter format
  const messages = [];
  if (systemInstruction) {
    messages.push({ role: "system", content: systemInstruction });
  }
  for (const item of chatHistory) {
    if (item.role === "user" || item.role === "model") {
      messages.push({
        role: item.role === "model" ? "assistant" : item.role,
        content: item.parts?.[0]?.text || ""
      });
    }
  }

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.SITE_URL || "https://your-vercel-app-url.vercel.app",
        "X-Title": "Qaim's Coder"
      },
      body: JSON.stringify({
        model,
        messages,
        stream: true,
        reasoning: { enabled: true }
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `OpenRouter API error: ${response.status}`);
    }

    // Set headers for streaming
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      buffer += chunk;

      // Process SSE lines
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('data: ')) {
          const data = trimmed.slice(6);
          if (data === '[DONE]') {
            continue;
          }
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              res.write(content);
            }
          } catch (e) {
            // Ignore JSON parse errors for incomplete data
          }
        }
      }
    }

    res.end();
  } catch (error) {
    if (res.headersSent) {
      console.error('Streaming error (headers already sent):', error);
      return;
    }
    res.status(500).json({ error: `Failed to generate code: ${(error as Error).message}` });
  }
}
import express from 'express';
import { createServer } from 'http';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = createServer(app);

app.use(express.json());

// Proxy to OpenRouter
app.post('/api/generate', async (req, res) => {
  const { chatHistory, systemInstruction, model = "stepfun/step-3.5-flash:free" } = req.body;

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "OPENROUTER_API_KEY environment variable is not configured." });
    return;
  }

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
        "HTTP-Referer": process.env.SITE_URL || "http://localhost:3000",
        "X-Title": "Qaim's Coder"
      },
      body: JSON.stringify({
        model,
        messages,
        stream: false,
        reasoning: { enabled: true }
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `OpenRouter API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    res.status(200).send(content);
  } catch (error) {
    res.status(500).json({ error: `Failed to generate code: ${error.message}` });
  }
});

const port = process.env.PORT || 3001;
server.listen(port, () => {
  console.log(`Local API server running on http://localhost:${port}`);
  console.log('Make sure to set OPENROUTER_API_KEY in your .env.local file');
});
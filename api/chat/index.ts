// api/chat/index.ts
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).send("Method not allowed");
    return;
  }

  try {
    const { messages, model = "openai/gpt-4o-mini", conversationId } = req.body;

    if (!messages || !Array.isArray(messages)) {
      res.status(400).json({ error: 'Messages array is required' });
      return;
    }

    // Get API key from environment
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      res.status(500).json({ error: 'OpenRouter API key not configured' });
      return;
    }

    // Prepare messages for OpenRouter
    const openRouterMessages = messages.map(msg => ({
      role: msg.role === 'model' ? 'assistant' : msg.role,
      content: msg.content || ''
    }));

    // Call OpenRouter API
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.SITE_URL || 'https://your-app.vercel.app',
        'X-Title': 'Qaims Coder - General Chat'
      },
      body: JSON.stringify({
        model,
        messages: openRouterMessages,
        stream: false,
        max_tokens: 2048,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('OpenRouter API error:', errorData);
      return res.status(response.status).json({
        error: errorData.error?.message || `API error: ${response.status}`
      });
    }

    const data = await response.json();
    const assistantMessage = data.choices?.[0]?.message?.content || '';

    res.status(200).json({
      success: true,
      message: assistantMessage,
      model: model,
      conversationId: conversationId || null
    });

  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({
      error: `Failed to process request: ${error instanceof Error ? error.message : 'Unknown error'}`
    });
  }
}

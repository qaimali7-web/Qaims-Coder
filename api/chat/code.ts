// api/chat/code.ts
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).send("Method not allowed");
    return;
  }

  try {
    const { messages, model, language, executeCode, projectId } = req.body;

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

    // Supported languages for code execution
    const SUPPORTED_LANGUAGES = [
      'python', 'javascript', 'typescript', 'java', 'cpp', 'c', 'go', 'rust',
      'ruby', 'php', 'swift', 'kotlin', 'csharp', 'html', 'css', 'sql', 'bash'
    ];

    // Build system prompt based on language and execution requirements
    let systemPrompt = `You are an expert programmer and coding assistant.`;

    if (language && SUPPORTED_LANGUAGES.includes(language)) {
      systemPrompt += ` You specialize in ${language}.`;
    }

    if (executeCode) {
      systemPrompt += ` When providing code, ensure it is safe to execute and includes necessary dependencies. For Python, use standard libraries when possible. For JavaScript/TypeScript, provide complete runnable examples.`;
    }

    systemPrompt += ` Provide clear explanations, best practices, and well-commented code. If the user asks to run code, provide a complete, self-contained example that can be executed.`;

    // Prepare messages for OpenRouter
    const openRouterMessages = [
      { role: 'system', content: systemPrompt },
      ...messages.map(msg => ({
        role: msg.role === 'model' ? 'assistant' : msg.role,
        content: msg.content || ''
      }))
    ];

    // Call OpenRouter API
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.SITE_URL || 'https://your-app.vercel.app',
        'X-Title': 'Qaims Coder - Code Assistant'
      },
      body: JSON.stringify({
        model: model || 'anthropic/claude-3.5-sonnet',
        messages: openRouterMessages,
        stream: false,
        max_tokens: 4096,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('OpenRouter API error:', errorData);
      res.status(response.status).json({
        error: errorData.error?.message || `API error: ${response.status}`
      });
      return;
    }

    const data = await response.json();
    const assistantMessage = data.choices?.[0]?.message?.content || '';

    // Extract code blocks from response if execution is requested
    let codeBlocks = [];
    if (executeCode && assistantMessage) {
      const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
      let match;
      while ((match = codeBlockRegex.exec(assistantMessage)) !== null) {
        codeBlocks.push({
          language: match[1] || 'text',
          code: match[2].trim()
        });
      }
    }

    res.status(200).json({
      success: true,
      message: assistantMessage,
      codeBlocks: codeBlocks.length > 0 ? codeBlocks : undefined,
      language: language || 'auto',
      model: model || 'anthropic/claude-3.5-sonnet'
    });

  } catch (error) {
    console.error('Code assistant error:', error);
    res.status(500).json({
      error: `Failed to process request: ${error instanceof Error ? error.message : 'Unknown error'}`
    });
  }
}

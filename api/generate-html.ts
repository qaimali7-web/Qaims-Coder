// api/generate-html.ts - Simple direct HTML generation with streaming
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).send("Method not allowed");
    return;
  }

  const { prompt, model = "stepfun/step-3.5-flash:free" } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "OPENROUTER_API_KEY not configured" });
  }

  // Set up SSE response
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');

  const sendEvent = (data: any) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  // Keep-alive to prevent timeout
  const keepAliveInterval = setInterval(() => {
    res.write(': keep-alive\n\n');
  }, 15000);

  try {
    sendEvent({
      type: 'progress',
      progress: {
        stage: 'generating',
        message: 'Generating your website...',
        percentage: 0,
      }
    });

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.SITE_URL || 'https://your-app.vercel.app',
        'X-Title': 'AI Website Builder',
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content: `You are an expert web developer. Create a complete, modern, responsive HTML file with embedded CSS and JavaScript.

CRITICAL REQUIREMENTS:
1. Return ONLY the complete HTML file. No markdown, no explanations, no code blocks.
2. Include all CSS in <style> tags within the HTML.
3. Include all JavaScript in <script> tags within the HTML.
4. Use modern CSS (Flexbox, Grid, CSS Variables).
5. Make it fully responsive with mobile-first design.
6. Use semantic HTML5 elements.
7. Add proper meta tags including viewport.
8. Include interactive elements if appropriate.
9. Use placeholder images from picsum.photos if needed.
10. Ensure the design is visually appealing and professional.

The HTML should be production-ready and self-contained.`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        stream: true,
        max_tokens: 16000,
        temperature: 0.8,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `OpenRouter error: ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let fullContent = '';
    let chunkCount = 0;
    let lastChunkTime = Date.now();
    const startTime = Date.now();

    sendEvent({
      type: 'progress',
      progress: {
        stage: 'generating',
        message: 'Receiving content...',
        percentage: 50,
      }
    });

    try {
      while (true) {
        // Timeout checks
        if (Date.now() - startTime > 90000) {
          console.warn('Generation timeout (90s)');
          break;
        }

        const { done, value } = await reader.read();
        if (done) break;

        lastChunkTime = Date.now();
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6);
            if (dataStr === '[DONE]') {
              break;
            }

            try {
              const data = JSON.parse(dataStr);
              const contentChunk = data.choices?.[0]?.delta?.content;
              if (contentChunk) {
                chunkCount++;
                fullContent += contentChunk;
                sendEvent({
                  type: 'chunk',
                  chunk: contentChunk,
                });
              }
            } catch (e) {
              // Skip invalid lines
            }
          }
        }

        // Stall detection
        if (Date.now() - lastChunkTime > 15000 && chunkCount > 0 && fullContent.length > 500) {
          console.log('Stall detected, completing with existing content');
          break;
        }
      }
    } catch (error: any) {
      if (error.message === 'Read timeout') {
        console.warn('Read timeout, using partial content');
      } else {
        throw error;
      }
    }

    // Clean up the content
    let htmlContent = fullContent
      .replace(/^```html\n?/, '')
      .replace(/^```\n?/, '')
      .replace(/\n?```$/g, '')
      .trim();

    // Validate we got HTML
    if (!htmlContent.includes('<') || !htmlContent.includes('</')) {
      throw new Error('Invalid HTML generated');
    }

    sendEvent({
      type: 'complete',
      content: htmlContent,
      length: htmlContent.length,
    });

  } catch (error: any) {
    console.error('Generation error:', error);
    sendEvent({
      type: 'error',
      error: {
        type: 'generation',
        message: error.message || 'Unknown error',
      },
    });
  } finally {
    clearInterval(keepAliveInterval);
    res.end();
  }
}

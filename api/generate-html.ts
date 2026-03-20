import type { VercelRequest, VercelResponse } from '@vercel/node';

// ─── In-memory rate limiter ───────────────────────────────────────────────────
// Simple token-bucket per IP — resets on cold start (good enough for serverless)

interface RateLimitBucket {
  count:     number;
  windowStart: number;
}

const rateLimitMap = new Map<string, RateLimitBucket>();
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX       = 10;     // 10 requests per minute per IP

function isRateLimited(ip: string): boolean {
  const now    = Date.now();
  const bucket = rateLimitMap.get(ip);

  if (!bucket || now - bucket.windowStart > RATE_LIMIT_WINDOW_MS) {
    // New window
    rateLimitMap.set(ip, { count: 1, windowStart: now });
    return false;
  }

  if (bucket.count >= RATE_LIMIT_MAX) return true;

  bucket.count++;
  return false;
}

// ─── SSE helpers ─────────────────────────────────────────────────────────────

type SSEPayload = Record<string, unknown>;

function sendSSE(res: VercelResponse, data: SSEPayload): void {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

// ─── System prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an expert, senior web developer specialising in modern, visually stunning websites.

Your task is to produce a SINGLE, complete, self-contained HTML file with all CSS and JavaScript embedded inline.

━━━ STRICT OUTPUT RULES ━━━
1. Output RAW HTML only. No markdown fences, no explanations, no preamble.
2. The very first character of your response must be "<" (the opening of <!DOCTYPE html>).
3. The very last characters must be "</html>".
4. Never truncate or leave the file incomplete.

━━━ TECHNICAL REQUIREMENTS ━━━
• Valid HTML5 with proper <!DOCTYPE html> and <meta charset="UTF-8">
• Responsive viewport meta tag
• All CSS inside a single <style> block in <head>
• All JS inside a single <script> block before </body>
• Use CSS custom properties (variables) for colours and spacing
• Flexbox/Grid layouts — no tables for layout
• Semantic HTML5 elements (header, main, section, article, footer, nav)
• ARIA labels on interactive elements
• Smooth scroll behaviour

━━━ DESIGN REQUIREMENTS ━━━
• Visually impressive, production-quality design
• Professional colour palette with strong contrast
• Fluid typography using clamp() where appropriate
• Micro-interactions and hover states via CSS transitions
• Placeholder images via https://picsum.photos/ (e.g. <img src="https://picsum.photos/800/500" alt="...">)
• Mobile-first responsive breakpoints

━━━ ABSOLUTELY FORBIDDEN ━━━
• External CSS frameworks (Bootstrap, Tailwind CDN, etc.)
• External JS libraries unless specifically requested
• Comments explaining the output format
• Markdown code fences (\`\`\`html)
• Partial/truncated output`;

// ─── Request body type ────────────────────────────────────────────────────────

interface RequestBody {
  prompt?:       string;
  model?:        string;
  existingCode?: string;
  isContinue?:   boolean;
}

// ─── Allowed models whitelist ─────────────────────────────────────────────────

const ALLOWED_MODELS = new Set([
  'stepfun/step-3.5-flash:free',
  'google/gemini-flash-1.5',
  'anthropic/claude-3.5-sonnet',
  'openai/gpt-4o',
  'deepseek/deepseek-chat',
]);

// ─── Main handler ─────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // ── Method guard ────────────────────────────────────────────────────────────
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // ── Rate limiting ────────────────────────────────────────────────────────────
  const ip =
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ??
    req.socket?.remoteAddress ??
    'unknown';

  if (isRateLimited(ip)) {
    res.status(429).json({
      error: 'Too many requests. Please wait a minute before trying again.',
    });
    return;
  }

  // ── API key guard ────────────────────────────────────────────────────────────
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'OPENROUTER_API_KEY is not configured on the server.' });
    return;
  }

  // ── Input validation ─────────────────────────────────────────────────────────
  const body = req.body as RequestBody;

  const prompt      = body.prompt?.trim() ?? '';
  const isContinue  = body.isContinue === true;
  const existingCode = typeof body.existingCode === 'string' ? body.existingCode : undefined;

  let model = typeof body.model === 'string' ? body.model : 'stepfun/step-3.5-flash:free';
  if (!ALLOWED_MODELS.has(model)) {
    model = 'stepfun/step-3.5-flash:free'; // silently fallback to safe default
  }

  if (!prompt) {
    res.status(400).json({ error: 'prompt is required and must not be empty.' });
    return;
  }

  if (prompt.length > 4000) {
    res.status(400).json({ error: 'prompt is too long (max 4000 characters).' });
    return;
  }

  // ── SSE setup ────────────────────────────────────────────────────────────────
  res.setHeader('Content-Type',                'text/event-stream');
  res.setHeader('Cache-Control',               'no-cache, no-transform');
  res.setHeader('Connection',                  'keep-alive');
  res.setHeader('X-Accel-Buffering',           'no');   // disable Nginx buffering
  res.setHeader('Access-Control-Allow-Origin', '*');

  // Keep-alive comment every 20 s to prevent proxy timeouts
  const keepAlive = setInterval(() => {
    res.write(': ping\n\n');
  }, 20_000);

  const cleanup = () => clearInterval(keepAlive);

  try {
    sendSSE(res, {
      type: 'progress',
      progress: { stage: 'connecting', message: 'Connecting to AI model…', percentage: 10 },
    });

    // ── Build messages ──────────────────────────────────────────────────────
    type Message = { role: 'system' | 'user' | 'assistant'; content: string };
    const messages: Message[] = [{ role: 'system', content: SYSTEM_PROMPT }];

    if (isContinue && existingCode) {
      // Feed back existing output so the model continues exactly from there
      messages.push({
        role: 'assistant',
        content: existingCode,
      });
      messages.push({
        role: 'user',
        content:
          'Continue writing the HTML file exactly from where you stopped. ' +
          'Do not repeat what you have already written. ' +
          'Continue seamlessly and finish the complete file ending with </html>. ' +
          `Original request was: ${prompt}`,
      });
    } else {
      messages.push({ role: 'user', content: prompt });
    }

    // ── Call OpenRouter ──────────────────────────────────────────────────────
    const upstream = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type':  'application/json',
        'HTTP-Referer':  process.env.SITE_URL ?? 'https://localhost:3000',
        'X-Title':       "Qaim's Coder",
      },
      body: JSON.stringify({
        model,
        messages,
        stream:     true,
        max_tokens: 16_000,
        temperature: 0.75,
      }),
    });

    if (!upstream.ok) {
      const errBody = await upstream.json().catch(() => ({}));
      const errMsg  = (errBody as { error?: { message?: string } }).error?.message
        ?? `OpenRouter returned HTTP ${upstream.status}`;
      throw new Error(errMsg);
    }

    if (!upstream.body) throw new Error('No response body from OpenRouter');

    sendSSE(res, {
      type: 'progress',
      progress: { stage: 'generating', message: 'Receiving content…', percentage: 30 },
    });

    // ── Stream processing ────────────────────────────────────────────────────
    const reader      = upstream.body.getReader();
    const decoder     = new TextDecoder();
    let   buffer      = '';
    let   fullContent = '';
    let   chunksSeen  = 0;
    const startTime   = Date.now();
    let   lastChunkAt = Date.now();

    const TIMEOUT_MS = 280_000; // just under Vercel's 300 s limit
    const STALL_MS   = 40_000;  // 40 s without a chunk = stalled

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const elapsed = Date.now() - startTime;
      const stalled = Date.now() - lastChunkAt;

      if (elapsed > TIMEOUT_MS) {
        sendSSE(res, {
          type: 'error',
          error: { type: 'timeout', message: 'Generation timeout — try a shorter prompt or use auto-continue.' },
        });
        break;
      }

      if (stalled > STALL_MS && chunksSeen > 0) {
        sendSSE(res, {
          type: 'error',
          error: { type: 'stall', message: 'Stall detected — no data for 40 s. Auto-retrying…' },
        });
        break;
      }

      const { done, value } = await reader.read();
      if (done) break;

      lastChunkAt = Date.now();
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;

        const raw = line.slice(6).trim();
        if (raw === '[DONE]') break;

        let parsed: { choices?: Array<{ delta?: { content?: string } }> };
        try { parsed = JSON.parse(raw); } catch { continue; }

        const chunk = parsed.choices?.[0]?.delta?.content;
        if (!chunk) continue;

        chunksSeen++;
        fullContent += chunk;

        sendSSE(res, { type: 'chunk', chunk });
      }
    }

    // ── Post-stream validation ───────────────────────────────────────────────
    // Strip any accidental markdown fences the model added
    let html = fullContent
      .replace(/^```html\s*/i, '')
      .replace(/^```\s*/,      '')
      .replace(/\s*```$/,      '')
      .trim();

    // Basic sanity check — must look like HTML
    if (!html.includes('<') || !html.includes('>')) {
      sendSSE(res, {
        type: 'error',
        error: { type: 'invalid', message: 'AI returned non-HTML content. Please try again.' },
      });
      cleanup();
      res.end();
      return;
    }

    // Check completeness (has </html>)
    const isComplete = /(<\/html>)/i.test(html);

    if (!isComplete && html.length > 200) {
      // Incomplete — signal the client to auto-continue
      sendSSE(res, {
        type: 'error',
        error: {
          type:    'incomplete',
          message: 'HTML generation incomplete — missing </html>. Auto-continuing…',
        },
      });
    } else if (isComplete) {
      sendSSE(res, {
        type:    'complete',
        content: html,
        length:  html.length,
      });
    } else {
      // Very short and still no HTML closing — genuine error
      sendSSE(res, {
        type: 'error',
        error: { type: 'invalid', message: 'Generated content too short to be valid HTML.' },
      });
    }

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'An unknown error occurred';
    console.error('[generate-html]', message);

    sendSSE(res, {
      type:  'error',
      error: { type: 'generation', message },
    });
  } finally {
    cleanup();
    res.end();
  }
}

// api/generate-html.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 1. Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { prompt, model } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    // 2. Check for API Key
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      console.error('Error: OPENROUTER_API_KEY is not defined in environment variables.');
      return res.status(500).json({ error: 'Server configuration error: API Key missing.' });
    }

    console.log(`Generation started with model: ${model || 'nvidia/nemotron-3-super-120b-a12b:free'}`);

    // 3. Prepare the request to OpenRouter
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.SITE_URL || 'http://localhost:3000',
        'X-Title': 'Qaim\'s Coder',
      },
      body: JSON.stringify({
        model: model || 'nvidia/nemotron-3-super-120b-a12b:free', // Fallback model
        messages: [
          {
            role: 'system',
            content: 'You are an expert web developer. Generate a single, self-contained HTML file based on the user request. Include CSS in <style> tags and JS in <script> tags. Do not use markdown code blocks. Output ONLY the HTML code.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        stream: true, // Enable streaming
        max_tokens: 16000,
      }),
    });

    // 4. Handle OpenRouter Errors
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`OpenRouter API Error: ${response.status} - ${errorText}`);
      return res.status(response.status).json({ error: `AI Provider Error: ${response.status} - ${errorText}` });
    }

    // 5. Set headers for Streaming
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');

    // 6. Parse and reformat OpenRouter stream
    const reader = response.body?.getReader();
    if (!reader) {
      res.write('data: ' + JSON.stringify({ error: 'Failed to get response stream' }) + '\n\n');
      res.end();
      return;
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let hasContent = false;
    
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        
        // Keep the last incomplete line in the buffer
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6).trim();
            
            if (dataStr === '[DONE]') {
              res.write('data: [DONE]\n\n');
              continue;
            }
            
            try {
              const data = JSON.parse(dataStr);
              const content = data.choices?.[0]?.delta?.content;
              
              if (content) {
                hasContent = true;
                res.write(`data: ${JSON.stringify({ code: content })}\n\n`);
              }
            } catch (e) {
              // Skip malformed JSON
            }
          }
        }
      }
      
      if (!hasContent) {
        console.warn('No content received from OpenRouter');
        res.write('data: ' + JSON.stringify({ error: 'No content generated' }) + '\n\n');
      }
      
      res.end();
    } catch (streamError) {
      console.error('Stream reading error:', streamError);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Stream error: ' + streamError });
      } else {
        res.write('data: ' + JSON.stringify({ error: 'Stream interrupted' }) + '\n\n');
        res.end();
      }
    }

  } catch (error: any) {
    console.error('Server Error:', error);
    // If headers haven't been sent yet, send a JSON error
    if (!res.headersSent) {
      res.status(500).json({ error: error.message || 'Internal Server Error' });
    } else {
      // If streaming already started, we can't send a JSON status, 
      // but we can try to write a comment or just end.
      res.end();
    }
  }
}

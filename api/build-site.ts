// api/build-site.ts - Project Architect with Streaming (Vercel Serverless)
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).send("Method not allowed");
    return;
  }

  const { prompt, projectId, model = "stepfun/step-3.5-flash:free" } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  // Set up SSE response with CORS headers for Vercel
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  const sendEvent = (data: any) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };
  
  // Send keep-alive comments every 15 seconds to prevent connection timeout
  const keepAliveInterval = setInterval(() => {
    res.write(': keep-alive\n\n');
  }, 15000);

  try {
    // Step 1: Generate Project Manifest
    sendEvent({
      type: 'progress',
      progress: {
        currentFile: '',
        fileIndex: 0,
        totalFiles: 0,
        stage: 'planning',
        message: 'Analyzing project requirements...',
        percentage: 10,
      }
    });

    const manifest = await generateManifest(prompt, model);
    
    sendEvent({
      type: 'progress',
      progress: {
        currentFile: 'manifest',
        fileIndex: 0,
        totalFiles: manifest.totalFiles,
        stage: 'planning',
        message: `Project plan ready: ${manifest.description}`,
        percentage: 20,
      }
    });

    // Step 2: Generate each file with streaming
    const files = [];
    for (let i = 0; i < manifest.files.length; i++) {
      const fileSpec = manifest.files[i];
      
      sendEvent({
        type: 'progress',
        progress: {
          currentFile: fileSpec.path,
          fileIndex: i + 1,
          totalFiles: manifest.totalFiles,
          stage: 'generating',
          message: `Generating ${fileSpec.path}...`,
          percentage: 20 + Math.round((i / manifest.totalFiles) * 60),
        }
      });

      console.log(`Starting generation of file ${i + 1}/${manifest.files.length}: ${fileSpec.path}`);
      
      try {
        const content = await generateFileContentStreaming(
          prompt,
          fileSpec,
          files, // previously generated files
          model,
          (chunk) => {
            // Send incremental updates to frontend
            sendEvent({
              type: 'file_chunk',
              filePath: fileSpec.path,
              chunk,
              fileIndex: i,
              totalFiles: manifest.totalFiles,
            });
          }
        );
        
        console.log(`Completed generation of file: ${fileSpec.path} (${content.length} chars)`);

        files.push({
          ...fileSpec,
          content,
        });

        sendEvent({
          type: 'file_complete',
          filePath: fileSpec.path,
          content,
        });
      } catch (fileError: any) {
        console.error(`Failed to generate file ${fileSpec.path}:`, fileError);
        sendEvent({
          type: 'error',
          error: {
            type: 'file_generation',
            message: `Failed to generate ${fileSpec.path}: ${fileError.message}`,
            filePath: fileSpec.path,
          },
        });
        // Continue with next file instead of stopping entire generation
        files.push({
          ...fileSpec,
          content: `// Error generating file: ${fileError.message}`,
        });
      }
    }

    // Step 3: Finalize
    sendEvent({
      type: 'progress',
      progress: {
        currentFile: '',
        fileIndex: manifest.totalFiles,
        totalFiles: manifest.totalFiles,
        stage: 'finalizing',
        message: 'Project generation complete',
        percentage: 100,
      }
    });

    sendEvent({
      type: 'complete',
      manifest,
      files,
    });

  } catch (error: any) {
    console.error('Build site error:', error);
    
    // Determine error type
    let errorType: string = 'unknown';
    if (error.message?.includes('context') || error.message?.includes('length')) {
      errorType = 'context_length';
    } else if (error.message?.includes('network') || error.message?.includes('fetch')) {
      errorType = 'network';
    } else if (error.message?.includes('rate limit')) {
      errorType = 'rate_limit';
    } else if (error.message?.includes('timeout')) {
      errorType = 'timeout';
    }

    sendEvent({
      type: 'error',
      error: {
        type: errorType,
        message: error.message || 'Unknown error',
        details: error.details,
        statusCode: error.statusCode,
      },
    });
  } finally {
    clearInterval(keepAliveInterval);
    res.end();
  }
}

// Helper to generate manifest using AI
async function generateManifest(prompt: string, model: string): Promise<any> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY not configured');
  }

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.SITE_URL || 'https://your-app.vercel.app',
      'X-Title': 'Qaims Coder - Project Architect',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: MANIFEST_SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      stream: false,
      max_tokens: 20000,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Manifest generation failed: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content?.trim() || '{}';
  
  // Clean up any markdown formatting
  const jsonStr = content
    .replace(/^```json\n?/, '')
    .replace(/^```\n?/, '')
    .replace(/\n?```$/, '');
  
  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    console.error('Failed to parse manifest:', jsonStr);
    throw new Error('AI returned invalid manifest format');
  }
}

// Helper to generate individual file content with streaming
async function generateFileContentStreaming(
  prompt: string,
  fileSpec: any,
  previousFiles: Array<{ path: string; content: string }>,
  model: string,
  onChunk: (chunk: string) => void
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY not configured');
  }

  // Build context from previous files (limited to avoid token limits)
  const context = previousFiles.length > 0
    ? `\n\nPreviously generated files (summarized):\n${previousFiles.map(f => {
        const ext = f.path.split('.').pop() || 'unknown';
        return `=== ${f.path} ===\nType: ${ext}\nSize: ${f.content.length} chars\nPreview: ${f.content.substring(0, 500)}${f.content.length > 500 ? '...' : ''}`;
      }).join('\n\n')}`
    : '';

  const userPrompt = fileSpec.language === 'html'
    ? `Create the ${fileSpec.path} file for: ${prompt}\n\n${context}\n\nReturn ONLY the raw ${fileSpec.language} code. No markdown. No explanations.`
    : `Create the ${fileSpec.path} file (${fileSpec.language}) for: ${prompt}\n\n${context}\n\nReturn ONLY the raw ${fileSpec.language} code. No markdown. No explanations.`;

  console.log(`Requesting ${fileSpec.path} from OpenRouter with model: ${model}`);
  console.log(`Context length: ${context.length} chars from ${previousFiles.length} previous files`);

  // Set up timeout (120 seconds)
  const controller = new AbortController();
  let timeoutId: NodeJS.Timeout;
  timeoutId = setTimeout(() => {
    console.error(`Timeout generating file: ${fileSpec.path}`);
    controller.abort();
  }, 120000);

  try {
    console.log(`Sending request to OpenRouter for ${fileSpec.path}...`);
    
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.SITE_URL || 'https://your-app.vercel.app',
        'X-Title': 'Qaims Coder - File Generator',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        stream: true, // Enable streaming
        max_tokens: 8000,
        temperature: 0.7,
      }),
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error(`OpenRouter error for ${fileSpec.path}:`, errorData);
      throw new Error(errorData.error?.message || `File generation failed: ${response.status}`);
    }

    console.log(`Stream response received for ${fileSpec.path}, status: ${response.status}`);

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body reader');
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let fullContent = '';
    let chunkCount = 0;
    let lastChunkTime = Date.now();
    let streamStartTime = Date.now();

    console.log(`Starting to read stream for ${fileSpec.path}`);

    try {
      while (true) {
        // Add a timeout to each read operation (10 seconds)
        const readPromise = reader.read();
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Read timeout')), 10000);
        });
        
        let result: { done: boolean; value: Uint8Array };
        try {
          result = await Promise.race([readPromise, timeoutPromise]) as { done: boolean; value: Uint8Array };
        } catch (err: any) {
          if (err.message === 'Read timeout') {
            // Check if we should force completion due to stall
            if (Date.now() - lastChunkTime > 15000 && fullContent.length > 1000) {
              console.warn(`Read timeout (stall) for ${fileSpec.path}, completing with ${fullContent.length} chars`);
              break;
            }
            // If we haven't received any chunks yet, continue waiting
            if (chunkCount === 0) {
              console.warn(`Read timeout before first chunk for ${fileSpec.path}, continuing...`);
              continue;
            }
            // Otherwise, consider it done
            console.warn(`Read timeout for ${fileSpec.path} after ${chunkCount} chunks, completing`);
            break;
          }
          throw err;
        }
        
        const { done, value } = result;
        
        if (done) {
          console.log(`Stream completed for ${fileSpec.path}, total chunks: ${chunkCount}`);
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6);
            if (dataStr === '[DONE]') {
              console.log(`Received [DONE] for ${fileSpec.path}`);
              break;
            }

            try {
              const data = JSON.parse(dataStr);
              const contentChunk = data.choices?.[0]?.delta?.content;
              if (contentChunk) {
              chunkCount++;
              lastChunkTime = Date.now();
              fullContent += contentChunk;
              onChunk(contentChunk);
              }
            } catch (e) {
              // Skip invalid JSON lines
            }
          }
        }
        
        // Check for stalled stream (no new chunks in 15 seconds)
        if (Date.now() - lastChunkTime > 15000 && chunkCount > 0) {
          console.warn(`Stream stalled for ${fileSpec.path}, no chunks for 15s - forcing completion`);
          // If we have at least 1000 characters, consider it done
          if (fullContent.length > 1000) {
            console.log(`Forcing completion of ${fileSpec.path} with ${fullContent.length} chars (stalled)`);
            break;
          }
        }
        
        // Hard timeout: if streaming takes more than 90 seconds, force complete
        if (Date.now() - streamStartTime > 90000) {
          console.warn(`Stream exceeded 90s timeout for ${fileSpec.path}, forcing completion`);
          break;
        }
      }
    } catch (error: any) {
      if (error.message === 'Read timeout') {
        console.warn(`Read timeout for ${fileSpec.path}, completing with ${fullContent.length} chars`);
        // Timeout is expected, we'll return what we have
      } else {
        throw error; // Re-throw other errors
      }
    }

    // Clean up markdown if present
    let cleanedContent = fullContent
      .replace(/^```\w+\n?/, '')
      .replace(/^```\n?/, '')
      .replace(/\n?```$/, '')
      .trim();

    console.log(`Finished ${fileSpec.path}, final length: ${cleanedContent.length} chars`);
    
    if (cleanedContent.length === 0) {
      console.warn(`Empty content generated for ${fileSpec.path}`);
    }

    return cleanedContent;
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('File generation timeout after 60 seconds');
    }
    throw error;
  }
}

// Keep the old function for backward compatibility
async function generateFileContent(
  prompt: string,
  fileSpec: any,
  previousFiles: Array<{ path: string; content: string }>,
  model: string
): Promise<string> {
  return generateFileContentStreaming(prompt, fileSpec, previousFiles, model, () => {});
}

// System prompts
const SYSTEM_PROMPT = `You are an expert full-stack web developer specializing in modern, responsive web design.

CRITICAL REQUIREMENTS:
1. Use ONLY semantic HTML5 elements (header, nav, main, section, article, footer, etc.)
2. Use MODERN CSS: Flexbox, CSS Grid, CSS Variables, media queries for responsiveness
3. NEVER use table-based layouts, <font> tags, or MSO tags
4. NEVER use inline styles except for dynamic values
5. Use external CSS classes and modern design patterns
6. Ensure mobile-first responsive design
7. Include proper viewport meta tag
8. Use modern JavaScript (ES6+) with event listeners, not inline onclick
9. Follow accessibility best practices (ARIA labels, semantic structure)
10. Optimize for performance (lazy loading, efficient selectors)

OUTPUT FORMAT:
- Return ONLY the raw code for each file
- No markdown formatting
- No explanations
- No \`\`\` code blocks`;

const MANIFEST_SYSTEM_PROMPT = `You are a project architect. Analyze the user's request and create a detailed plan for a modern web project.

Respond with a JSON object in this EXACT format (no markdown, no extra text):
{
  "structure": "single-page" | "multi-page" | "app",
  "files": [
    {
      "path": "index.html",
      "language": "html",
      "isMain": true,
      "description": "Main HTML file with semantic structure"
    },
    {
      "path": "styles/main.css",
      "language": "css",
      "isMain": false,
      "description": "Main stylesheet with CSS variables and responsive design"
    },
    {
      "path": "scripts/main.js",
      "language": "javascript",
      "isMain": false,
      "description": "Main JavaScript for interactivity"
    }
  ],
  "description": "Brief project description",
  "totalFiles": 3
}

RULES:
- Always include index.html as the main file
- Separate CSS into its own file(s)
- Separate JavaScript into its own file(s)
- Use relative paths
- Keep structure simple but scalable
- Only include necessary files`;

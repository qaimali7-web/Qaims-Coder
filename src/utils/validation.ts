/**
 * Validation utilities for the application
 */

/**
 * Validates OpenRouter API key format
 * OpenRouter API keys start with "sk-or-v1-" followed by 64 hex characters
 */
export function validateOpenRouterApiKey(apiKey: string): boolean {
  if (!apiKey || typeof apiKey !== 'string') {
    return false;
  }

  // OpenRouter API key format: sk-or-v1-<64 hex characters>
  const pattern = /^sk-or-v1-[a-f0-9]{64}$/i;
  return pattern.test(apiKey.trim());
}

/**
 * Validates URL format
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Sanitizes HTML to prevent XSS
 */
export function sanitizeHtml(html: string): string {
  // Basic sanitization - remove script tags and event handlers
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+="[^"]*"/gi, '')
    .replace(/on\w+='[^']*'/gi, '');
}

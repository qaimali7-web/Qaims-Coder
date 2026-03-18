/**
 * Browser compatibility utilities and polyfills
 */

// Check if features are supported
export const supports = {
  // Check for fetch API
  fetch: typeof fetch !== 'undefined',
  // Check for Promise
  promise: typeof Promise !== 'undefined',
  // Check for async/await (ES2017)
  asyncAwait: (() => {
    try {
      eval('async function test() {}');
      return true;
    } catch {
      return false;
    }
  })(),
  // Check for optional chaining
  optionalChaining: (() => {
    try {
      eval('(a?.b)');
      return true;
    } catch {
      return false;
    }
  })(),
  // Check for nullish coalescing
  nullishCoalescing: (() => {
    try {
      eval('(a ?? b)');
      return true;
    } catch {
      return false;
    }
  })(),
};

/**
 * Polyfill for Promise if not supported
 * Note: Modern browsers all support Promise, this is just for completeness
 */
export function polyfillPromise(): void {
  if (!supports.promise) {
    // Simple Promise polyfill would go here
    console.warn('Promise not supported. Please upgrade your browser.');
  }
}

/**
 * Polyfill for fetch if not supported
 * Note: Modern browsers all support fetch, this is just for completeness
 */
export function polyfillFetch(): void {
  if (!supports.fetch) {
    // Simple fetch polyfill would go here
    console.warn('Fetch API not supported. Please upgrade your browser.');
  }
}

/**
 * Checks if the browser is outdated and shows a warning
 */
export function checkBrowserCompatibility(): boolean {
  const unsupported = [];

  if (!supports.promise) unsupported.push('Promise');
  if (!supports.fetch) unsupported.push('Fetch API');
  if (!supports.asyncAwait) unsupported.push('async/await');
  if (!supports.optionalChaining) unsupported.push('Optional chaining (?.)');
  if (!supports.nullishCoalescing) unsupported.push('Nullish coalescing (??)');

  if (unsupported.length > 0) {
    console.warn(
      `Your browser doesn't support: ${unsupported.join(', ')}. ` +
      'Some features may not work correctly. Please upgrade to a modern browser.'
    );
    return false;
  }

  return true;
}

/**
 * Get user agent info
 */
export function getUserAgent(): {
  browser: string;
  version: string;
  isMobile: boolean;
  isOld: boolean;
} {
  const ua = navigator.userAgent;
  let browser = 'Unknown';
  let version = '0';

  // Detect browser
  if (ua.includes('Firefox/')) {
    browser = 'Firefox';
    version = ua.match(/Firefox\/(\d+)/)?.[1] || '0';
  } else if (ua.includes('Chrome/') && !ua.includes('Edg/')) {
    browser = 'Chrome';
    version = ua.match(/Chrome\/(\d+)/)?.[1] || '0';
  } else if (ua.includes('Safari/') && !ua.includes('Chrome/')) {
    browser = 'Safari';
    version = ua.match(/Version\/(\d+)/)?.[1] || '0';
  } else if (ua.includes('Edg/')) {
    browser = 'Edge';
    version = ua.match(/Edg\/(\d+)/)?.[1] || '0';
  }

  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  const isOld = parseInt(version) < 80; // Consider browsers older than version 80 as old

  return { browser, version, isMobile, isOld };
}

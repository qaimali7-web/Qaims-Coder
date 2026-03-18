/**
 * Code formatting utilities
 * Note: Full Prettier integration can be added later if needed
 */

/**
 * Basic HTML formatting
 */
export function formatHtml(html: string): string {
  // Simple formatting: ensure consistent indentation and line breaks
  const lines = html.split('\n');
  const formattedLines: string[] = [];
  let indent = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      formattedLines.push('');
      continue;
    }

    // Adjust indent based on tags
    const isClosing = trimmed.startsWith('</');
    const isOpening = trimmed.startsWith('<') && !trimmed.startsWith('<!') && !trimmed.startsWith('</');
    const isSelfClosing = trimmed.endsWith('/>') || ['<br>', '<hr>', '<img>', '<input>', '<meta>', '<link>', '<br/>', '<hr/>', '<img/>', '<input/>'].some(tag => trimmed.startsWith(tag));

    if (isClosing) {
      indent = Math.max(0, indent - 1);
    }

    formattedLines.push('  '.repeat(indent) + trimmed);

    if (isOpening && !isSelfClosing && !trimmed.endsWith('/>') && !trimmed.includes('</')) {
      indent++;
    }
  }

  return formattedLines.join('\n');
}

/**
 * Formats code based on language
 */
export function formatCode(code: string, language: string = 'html'): string {
  switch (language.toLowerCase()) {
    case 'html':
      return formatHtml(code);
    default:
      return code.split('\n').map(line => line.trimEnd()).join('\n');
  }
}

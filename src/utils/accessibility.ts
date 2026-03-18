/**
 * Accessibility utilities for the application
 */

/**
 * Announces a message to screen readers
 */
export function announceToScreenReader(message: string): void {
  const announcement = document.createElement('div');
  announcement.setAttribute('aria-live', 'polite');
  announcement.setAttribute('aria-atomic', 'true');
  announcement.setAttribute('role', 'status');
  announcement.setAttribute('class', 'sr-only');
  announcement.textContent = message;

  document.body.appendChild(announcement);

  // Remove after announcement
  setTimeout(() => {
    document.body.removeChild(announcement);
  }, 1000);
}

/**
 * Focuses an element and ensures it's visible
 */
export function focusElement(element: HTMLElement | null): void {
  if (element) {
    element.focus();
    element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

/**
 * Traps focus within a container (for modals, overlays)
 */
export function trapFocus(container: HTMLElement): () => void {
  const focusableElements = container.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  const firstElement = focusableElements[0] as HTMLElement;
  const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

  function handleTabKey(e: KeyboardEvent) {
    if (e.key === 'Tab') {
      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    }
  }

  document.addEventListener('keydown', handleTabKey);

  // Return cleanup function
  return () => {
    document.removeEventListener('keydown', handleTabKey);
  };
}

/**
 * Checks if an element has sufficient color contrast
 * Returns true if contrast ratio is at least 4.5:1 for normal text
 */
export function checkColorContrast(
  foreground: string,
  background: string
): boolean {
  // Convert hex to RGB
  const hexToRgb = (hex: string): { r: number; g: number; b: number } => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16),
        }
      : { r: 0, g: 0, b: 0 };
  };

  const getLuminance = (r: number, g: number, b: number): number => {
    const [rs, gs, bs] = [r, g, b].map((c) => {
      c = c / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
  };

  const fg = hexToRgb(foreground);
  const bg = hexToRgb(background);

  const luminance1 = getLuminance(fg.r, fg.g, fg.b);
  const luminance2 = getLuminance(bg.r, bg.g, bg.b);

  const brightest = Math.max(luminance1, luminance2);
  const darkest = Math.min(luminance1, luminance2);

  const contrastRatio = (brightest + 0.05) / (darkest + 0.05);

  return contrastRatio >= 4.5;
}

/**
 * Generates a unique ID for ARIA attributes
 */
export function generateUniqueId(prefix: string = 'qaims'): string {
  return `${prefix}-${Math.random().toString(36).substr(2, 9)}`;
}

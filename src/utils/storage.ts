/**
 * Storage utilities for managing version history and settings
 */

export const MAX_VERSION_HISTORY = 50; // Limit to prevent memory issues

/**
 * Saves version history to localStorage
 */
export function saveVersionHistory(history: Array<{ prompt: string; code: string; timestamp: string }>): void {
  try {
    const limited = history.slice(0, MAX_VERSION_HISTORY);
    localStorage.setItem('qaims-coder-history', JSON.stringify(limited));
  } catch (error) {
    console.error('Failed to save version history:', error);
  }
}

/**
 * Loads version history from localStorage
 */
export function loadVersionHistory(): Array<{ prompt: string; code: string; timestamp: string }> {
  try {
    const saved = localStorage.getItem('qaims-coder-history');
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (error) {
    console.error('Failed to load version history:', error);
  }
  return [];
}

/**
 * Clears version history from localStorage
 */
export function clearVersionHistory(): void {
  try {
    localStorage.removeItem('qaims-coder-history');
  } catch (error) {
    console.error('Failed to clear version history:', error);
  }
}

/**
 * Saves current code to localStorage for auto-recovery
 */
export function saveCurrentCode(code: string): void {
  try {
    localStorage.setItem('qaims-coder-current', code);
  } catch (error) {
    console.error('Failed to save current code:', error);
  }
}

/**
 * Loads current code from localStorage for auto-recovery
 */
export function loadCurrentCode(): string {
  try {
    return localStorage.getItem('qaims-coder-current') || '';
  } catch (error) {
    console.error('Failed to load current code:', error);
    return '';
  }
}

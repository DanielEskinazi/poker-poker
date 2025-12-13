/**
 * Clipboard Utility
 *
 * Provides clipboard copy functionality with visual feedback.
 * Implements User Story 1 (US1) - Session Creation & Link Sharing
 */

export interface CopyToClipboardOptions {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

/**
 * Copy text to clipboard
 *
 * Uses the modern Clipboard API with fallback to older execCommand method.
 */
export async function copyToClipboard(
  text: string,
  options?: CopyToClipboardOptions
): Promise<boolean> {
  try {
    // Try modern Clipboard API first (preferred method)
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      options?.onSuccess?.();
      return true;
    }

    // Fallback to execCommand (for older browsers)
    const textArea = document.createElement('textarea');
    textArea.value = text;

    // Make the textarea invisible and uneditable
    textArea.style.position = 'fixed';
    textArea.style.top = '-9999px';
    textArea.style.left = '-9999px';
    textArea.setAttribute('readonly', '');

    document.body.appendChild(textArea);
    textArea.select();
    textArea.setSelectionRange(0, text.length);

    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);

    if (successful) {
      options?.onSuccess?.();
      return true;
    } else {
      throw new Error('execCommand copy failed');
    }
  } catch (error) {
    console.error('[Clipboard] Failed to copy:', error);
    options?.onError?.(error as Error);
    return false;
  }
}

/**
 * Check if clipboard API is available
 */
export function isClipboardSupported(): boolean {
  return !!(
    navigator.clipboard?.writeText ||
    document.queryCommandSupported?.('copy')
  );
}

/**
 * Copy session URL to clipboard with standard messaging
 */
export async function copySessionUrl(
  sessionId: string,
  baseUrl?: string
): Promise<{ success: boolean; url: string }> {
  const url = baseUrl
    ? `${baseUrl}/session/${sessionId}`
    : `${window.location.origin}/session/${sessionId}`;

  const success = await copyToClipboard(url);

  return { success, url };
}

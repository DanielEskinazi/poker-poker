import React from 'react';

interface ReconnectionBannerProps {
  isReconnecting: boolean;
  isConnectionFailed: boolean;
  attemptNumber: number | undefined;
  onRetry: () => void;
}

/**
 * ReconnectionBanner Component
 *
 * Displays a banner when the WebSocket connection is lost or being reconnected.
 * Shows different states: reconnecting (with attempt count) or failed (with retry button).
 */
export const ReconnectionBanner: React.FC<ReconnectionBannerProps> = ({
  isReconnecting,
  isConnectionFailed,
  attemptNumber,
  onRetry,
}) => {
  if (!isReconnecting && !isConnectionFailed) {
    return null;
  }

  if (isConnectionFailed) {
    return (
      <div className="fixed top-0 left-0 right-0 z-50 bg-red-600 text-white px-4 py-3 shadow-lg">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <span className="font-medium">Connection lost. Unable to reconnect.</span>
          </div>
          <button
            onClick={onRetry}
            className="px-4 py-1.5 bg-white text-red-600 rounded-md font-medium hover:bg-red-50 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-yellow-500 text-yellow-900 px-4 py-3 shadow-lg">
      <div className="max-w-4xl mx-auto flex items-center gap-3">
        <svg
          className="w-5 h-5 animate-spin"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          />
        </svg>
        <span className="font-medium">
          Reconnecting{attemptNumber ? ` (attempt ${attemptNumber}/5)` : ''}...
        </span>
      </div>
    </div>
  );
};

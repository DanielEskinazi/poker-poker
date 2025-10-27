import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../hooks/useSession';

/**
 * HomePage Component
 *
 * Landing page for creating new Planning Poker sessions.
 * Implements User Story 1 (US1) - Session Creation & Link Sharing
 */

export const HomePage: React.FC = () => {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { createSession } = useSession();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate name
    const trimmedName = name.trim();

    if (!trimmedName) {
      setError('Name is required and must be 1-50 characters');
      return;
    }

    if (trimmedName.length > 50) {
      setError('Name must be 50 characters or less');
      return;
    }

    setIsLoading(true);

    try {
      // Create session
      const result = await createSession(trimmedName);

      // Redirect to session page
      navigate(`/session/${result.sessionId}`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create session';
      setError(errorMessage);
      setIsLoading(false);
    }
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value);
    // Clear error when user starts typing
    if (error) {
      setError('');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Planning Poker
          </h1>
          <p className="text-gray-600">
            Estimate stories with your team in real-time
          </p>
        </div>

        {/* Create Session Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Name Input */}
          <div>
            <label
              htmlFor="name-input"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Your Name
            </label>
            <input
              id="name-input"
              data-testid="name-input"
              type="text"
              value={name}
              onChange={handleNameChange}
              placeholder="Enter your name"
              className={`
                w-full px-4 py-3 rounded-lg border-2 transition-colors
                ${error
                  ? 'border-red-500 focus:border-red-500 focus:ring-red-200'
                  : 'border-gray-300 focus:border-indigo-500 focus:ring-indigo-200'
                }
                focus:outline-none focus:ring-4
                disabled:bg-gray-100 disabled:cursor-not-allowed
              `}
              disabled={isLoading}
              maxLength={50}
              autoFocus
            />

            {/* Error Message */}
            {error && (
              <p
                data-testid="name-error"
                className="mt-2 text-sm text-red-600 flex items-center"
              >
                <svg
                  className="w-4 h-4 mr-1 flex-shrink-0"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                  width="16"
                  height="16"
                >
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
                {error}
              </p>
            )}

            {/* Character Counter */}
            <p className="mt-2 text-xs text-gray-500 text-right">
              {name.length}/50 characters
            </p>
          </div>

          {/* Create Session Button */}
          <button
            type="submit"
            data-testid="create-session-btn"
            disabled={isLoading || !name.trim()}
            className={`
              w-full py-3 px-6 rounded-lg font-semibold text-white
              transition-all transform
              ${isLoading || !name.trim()
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-indigo-600 hover:bg-indigo-700 hover:scale-105 active:scale-95'
              }
              focus:outline-none focus:ring-4 focus:ring-indigo-300
            `}
          >
            {isLoading ? (
              <span className="flex items-center justify-center">
                <svg
                  className="animate-spin -ml-1 mr-3 h-5 w-5 text-white flex-shrink-0"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  width="20"
                  height="20"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Creating Session...
              </span>
            ) : (
              'Create Session'
            )}
          </button>
        </form>

        {/* Features List */}
        <div className="mt-8 pt-6 border-t border-gray-200">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">
            Features:
          </h3>
          <ul className="space-y-2 text-sm text-gray-600">
            <li className="flex items-start">
              <svg
                className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5"
                fill="currentColor"
                viewBox="0 0 20 20"
                width="20"
                height="20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              <span>No login required - anonymous sessions</span>
            </li>
            <li className="flex items-start">
              <svg
                className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5"
                fill="currentColor"
                viewBox="0 0 20 20"
                width="20"
                height="20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              <span>Real-time voting with Fibonacci cards</span>
            </li>
            <li className="flex items-start">
              <svg
                className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5"
                fill="currentColor"
                viewBox="0 0 20 20"
                width="20"
                height="20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              <span>Up to 20 participants per session</span>
            </li>
            <li className="flex items-start">
              <svg
                className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5"
                fill="currentColor"
                viewBox="0 0 20 20"
                width="20"
                height="20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              <span>Export results to Excel</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../hooks/useSession';

/**
 * HomePage Component
 *
 * Landing page for creating new Planning Poker sessions.
 * Slate & Stone theme - Corporate Minimalism.
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

    const trimmedName = name.trim();

    if (!trimmedName) {
      setError('Please enter your name to continue');
      return;
    }

    if (trimmedName.length > 50) {
      setError('Name must be 50 characters or less');
      return;
    }

    setIsLoading(true);

    try {
      const result = await createSession(trimmedName);
      navigate(`/session/${result.sessionId}`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create session';
      setError(errorMessage);
      setIsLoading(false);
    }
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value);
    if (error) {
      setError('');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-slide-up">
        {/* Main Card */}
        <div className="bg-white rounded-2xl shadow-elevated p-8 border border-slate-200/60">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-14 h-14 mx-auto mb-4 bg-primary-500 rounded-xl flex items-center justify-center shadow-lg shadow-primary-500/20">
              <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
              </svg>
            </div>
            <h1 className="text-2xl font-semibold text-slate-900 mb-1">
              Planning Poker
            </h1>
            <p className="text-slate-500 text-sm">
              Collaborative estimation for agile teams
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="name-input"
                className="label"
              >
                Your name
              </label>
              <input
                id="name-input"
                data-testid="name-input"
                type="text"
                value={name}
                onChange={handleNameChange}
                placeholder="Enter your name"
                className="input"
                disabled={isLoading}
                maxLength={50}
                autoFocus
              />

              {/* Error Message */}
              {error && (
                <div className="mt-2 flex items-center gap-2 text-error-600 animate-fade-in">
                  <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <p data-testid="name-error" className="text-sm">{error}</p>
                </div>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              data-testid="create-session-btn"
              disabled={isLoading || !name.trim()}
              className={`
                w-full py-3 px-4 rounded-lg font-medium text-white
                transition-all duration-200
                ${isLoading || !name.trim()
                  ? 'bg-slate-300 cursor-not-allowed'
                  : 'bg-primary-500 hover:bg-primary-600 active:scale-[0.98] shadow-md shadow-primary-500/20'
                }
                focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2
              `}
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Creating session...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  Create Session
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </span>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="divider" />

          {/* Features */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Real-time voting', icon: '⚡' },
              { label: 'Fibonacci scale', icon: '📊' },
              { label: 'Anonymous until reveal', icon: '🔒' },
              { label: 'No signup required', icon: '✨' },
            ].map((feature, index) => (
              <div
                key={index}
                className="flex items-center gap-2 text-sm text-slate-600 p-2 rounded-lg bg-slate-50"
              >
                <span className="text-base">{feature.icon}</span>
                <span>{feature.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-slate-400 text-xs mt-6">
          Simple, fast, and effective sprint estimation
        </p>
      </div>
    </div>
  );
};

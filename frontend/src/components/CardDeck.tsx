import { useState } from 'react';

/**
 * CardDeck Component
 *
 * Displays Fibonacci cards (1, 2, 3, 5, 8, 13, 21, ?) for Planning Poker voting.
 * Allows participants to select a card to cast their vote.
 */

type CardValue = 1 | 2 | 3 | 5 | 8 | 13 | 21 | '?';

const CARD_DECK: readonly CardValue[] = [1, 2, 3, 5, 8, 13, 21, '?'] as const;

interface CardDeckProps {
  onCardSelect: (value: CardValue) => void;
  selectedCard: CardValue | null;
  disabled?: boolean;
  votingState?: 'voting' | 'revealed';
}

export function CardDeck({ onCardSelect, selectedCard, disabled = false, votingState = 'voting' }: CardDeckProps) {
  const [hoverCard, setHoverCard] = useState<CardValue | null>(null);

  const isDisabled = disabled || votingState === 'revealed';

  return (
    <div className="w-full">
      <h3 className="text-lg font-semibold text-gray-700 mb-4">
        {votingState === 'revealed' ? 'Votes Revealed' : 'Select Your Card'}
      </h3>

      <div className="grid grid-cols-4 sm:grid-cols-8 gap-3">
        {CARD_DECK.map((value) => {
          const isSelected = selectedCard === value;
          const isHovered = hoverCard === value;

          return (
            <button
              key={value}
              onClick={() => !isDisabled && onCardSelect(value)}
              onMouseEnter={() => !isDisabled && setHoverCard(value)}
              onMouseLeave={() => setHoverCard(null)}
              disabled={isDisabled}
              className={`
                relative
                aspect-[2/3]
                rounded-xl
                border-2
                flex items-center justify-center
                font-bold text-2xl
                transition-all duration-200
                transform
                ${isDisabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:scale-110'}
                ${isSelected
                  ? 'bg-blue-500 border-blue-600 text-white shadow-lg scale-105'
                  : isHovered
                    ? 'bg-blue-100 border-blue-400 text-blue-700'
                    : 'bg-white border-gray-300 text-gray-700 hover:border-blue-300'
                }
                ${isDisabled ? '' : 'active:scale-95'}
              `}
              aria-label={`Vote ${value}`}
              aria-pressed={isSelected}
              data-testid={`card-${value}`}
            >
              {/* Card value */}
              <span className="relative z-10">
                {value}
              </span>

              {/* Selected indicator */}
              {isSelected && !isDisabled && (
                <div className="absolute top-1 right-1">
                  <svg
                    className="w-5 h-5 text-white"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Voting instructions */}
      {!isDisabled && (
        <p className="mt-4 text-sm text-gray-500 text-center">
          {selectedCard
            ? 'Click a different card to change your vote'
            : 'Click a card to cast your vote'}
        </p>
      )}

      {/* Revealed state message */}
      {votingState === 'revealed' && (
        <p className="mt-4 text-sm text-blue-600 text-center font-medium">
          Votes have been revealed. Waiting for moderator to reset...
        </p>
      )}
    </div>
  );
}

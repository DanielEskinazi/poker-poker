import { useState } from 'react';

/**
 * CardDeck Component
 *
 * Displays Fibonacci cards for Planning Poker voting.
 * Slate & Stone theme - clean, minimal card styling.
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
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-base font-semibold text-slate-900">
            {votingState === 'revealed' ? 'Voting Complete' : 'Select Your Estimate'}
          </h3>
          <p className="text-sm text-slate-500">Fibonacci sequence</p>
        </div>

        {selectedCard !== null && votingState === 'voting' && (
          <div className="badge badge-primary">
            Selected: {selectedCard}
          </div>
        )}
      </div>

      {/* Card Grid */}
      <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 sm:gap-3 card-stagger">
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
                group relative
                aspect-[3/4]
                rounded-xl
                flex flex-col items-center justify-center
                transition-all duration-200
                border-2
                ${isDisabled
                  ? 'cursor-not-allowed opacity-50'
                  : 'cursor-pointer hover:-translate-y-1 hover:shadow-card-hover'
                }
                ${isSelected
                  ? 'bg-primary-50 border-primary-500 shadow-md'
                  : isHovered
                    ? 'bg-slate-50 border-slate-300'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }
                ${isDisabled ? '' : 'active:scale-95'}
              `}
              aria-label={`Vote ${value}`}
              aria-pressed={isSelected}
              data-testid={`card-${value}`}
            >
              {/* Card Value */}
              <span
                className={`
                  font-semibold transition-all duration-200
                  ${value === '?' ? 'text-2xl sm:text-3xl' : 'text-xl sm:text-2xl'}
                  ${isSelected
                    ? 'text-primary-600'
                    : 'text-slate-700 group-hover:text-slate-900'
                  }
                `}
              >
                {value}
              </span>

              {/* Point label */}
              <span className={`
                text-[10px] font-medium mt-1 transition-colors
                ${isSelected ? 'text-primary-500' : 'text-slate-400'}
              `}>
                {value === '?' ? 'unsure' : 'pts'}
              </span>

              {/* Selected checkmark */}
              {isSelected && !isDisabled && (
                <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-primary-500 flex items-center justify-center animate-scale-in">
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Instructions */}
      {!isDisabled && (
        <p className="mt-5 text-center text-sm text-slate-500">
          {selectedCard ? 'Click another card to change your estimate' : 'Click a card to submit your estimate'}
        </p>
      )}

      {/* Revealed state message */}
      {votingState === 'revealed' && (
        <div className="mt-5 flex items-center justify-center gap-2 py-3 px-4 rounded-lg bg-slate-100 text-slate-600">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <span className="text-sm font-medium">Voting is locked — waiting for new round</span>
        </div>
      )}
    </div>
  );
}

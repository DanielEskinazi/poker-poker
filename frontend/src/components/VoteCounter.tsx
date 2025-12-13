/**
 * VoteCounter Component
 *
 * Displays voting progress with clean metrics.
 * Slate & Stone theme - minimal progress display.
 */

interface VoteCounterProps {
  votedCount: number;
  totalParticipants: number;
  votingState?: 'voting' | 'revealed';
}

export function VoteCounter({ votedCount, totalParticipants, votingState = 'voting' }: VoteCounterProps) {
  const percentage = totalParticipants > 0 ? (votedCount / totalParticipants) * 100 : 0;
  const allVoted = votedCount === totalParticipants && totalParticipants > 0;

  return (
    <div className="w-full bg-white rounded-xl border border-slate-200 p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Voting Progress</h3>
          <p className="text-sm text-slate-500">
            {votedCount} of {totalParticipants} voted
          </p>
        </div>

        {/* Status Badge */}
        <div className={`
          badge
          ${votingState === 'revealed'
            ? 'badge-success'
            : allVoted
              ? 'badge-warning'
              : 'badge-neutral'
          }
        `}>
          {votingState === 'revealed' ? 'Complete' : allVoted ? 'Ready to reveal' : 'In progress'}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-4">
        <div className="progress-bar h-2">
          <div
            className={`progress-fill ${allVoted ? 'bg-success-500' : ''}`}
            style={{ width: `${percentage}%` }}
            role="progressbar"
            aria-valuenow={votedCount}
            aria-valuemin={0}
            aria-valuemax={totalParticipants}
          />
        </div>
        <div className="flex justify-between mt-2 text-xs text-slate-500">
          <span>{percentage.toFixed(0)}% complete</span>
          <span>{totalParticipants - votedCount} remaining</span>
        </div>
      </div>

      {/* Visual indicators for small groups */}
      {totalParticipants > 0 && totalParticipants <= 10 && (
        <div className="flex justify-center gap-2 mb-4">
          {[...Array(totalParticipants)].map((_, i) => (
            <div
              key={i}
              className={`
                w-8 h-8 rounded-lg flex items-center justify-center text-xs font-medium
                transition-all duration-300
                ${i < votedCount
                  ? 'bg-primary-100 text-primary-600 border border-primary-200'
                  : 'bg-slate-100 text-slate-400 border border-slate-200'
                }
              `}
              style={{ transitionDelay: `${i * 30}ms` }}
            >
              {i < votedCount ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                i + 1
              )}
            </div>
          ))}
        </div>
      )}

      {/* Status Message */}
      <div className="flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-slate-50 text-sm">
        {!allVoted && votingState === 'voting' && (
          <>
            <div className="w-2 h-2 rounded-full bg-warning-400 animate-pulse" />
            <span className="text-slate-600">
              Waiting for {totalParticipants - votedCount} more {totalParticipants - votedCount === 1 ? 'vote' : 'votes'}...
            </span>
          </>
        )}
        {allVoted && votingState === 'voting' && (
          <>
            <svg className="w-4 h-4 text-success-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-success-600 font-medium">All votes in — ready to reveal!</span>
          </>
        )}
        {votingState === 'revealed' && (
          <>
            <svg className="w-4 h-4 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="text-slate-600">Results revealed</span>
          </>
        )}
      </div>
    </div>
  );
}

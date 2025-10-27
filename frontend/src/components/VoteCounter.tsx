/**
 * VoteCounter Component
 *
 * Displays the number of participants who have voted vs total participants.
 * Shows "X of Y voted" status with visual progress indicator.
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
    <div className="w-full bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-gray-700">
          Voting Progress
        </h3>

        {/* Status indicator */}
        <div className={`
          flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium
          ${votingState === 'revealed'
            ? 'bg-green-100 text-green-700'
            : allVoted
              ? 'bg-blue-100 text-blue-700'
              : 'bg-gray-100 text-gray-600'
          }
        `}>
          {votingState === 'revealed' ? (
            <>
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>Revealed</span>
            </>
          ) : allVoted ? (
            <>
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>All Voted</span>
            </>
          ) : (
            <>
              <svg className="w-4 h-4 animate-pulse" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
              </svg>
              <span>Voting</span>
            </>
          )}
        </div>
      </div>

      {/* Vote count display */}
      <div className="mb-4">
        <div className="flex items-baseline justify-center gap-2">
          <span className="text-4xl font-bold text-gray-800" data-testid="vote-count">
            {votedCount}
          </span>
          <span className="text-2xl text-gray-400">/</span>
          <span className="text-2xl font-semibold text-gray-600" data-testid="total-participants">
            {totalParticipants}
          </span>
        </div>
        <p className="text-center text-sm text-gray-500 mt-1">
          {votedCount === 1 ? 'participant has' : 'participants have'} voted
        </p>
      </div>

      {/* Progress bar */}
      <div className="relative w-full h-3 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`
            absolute top-0 left-0 h-full rounded-full transition-all duration-500 ease-out
            ${allVoted
              ? 'bg-gradient-to-r from-green-400 to-green-500'
              : 'bg-gradient-to-r from-blue-400 to-blue-500'
            }
          `}
          style={{ width: `${percentage}%` }}
          role="progressbar"
          aria-valuenow={votedCount}
          aria-valuemin={0}
          aria-valuemax={totalParticipants}
        >
          {/* Animated shine effect */}
          {percentage > 0 && percentage < 100 && (
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-30 animate-shimmer" />
          )}
        </div>
      </div>

      {/* Percentage display */}
      <div className="mt-2 text-center">
        <span className="text-xs font-medium text-gray-500">
          {percentage.toFixed(0)}% Complete
        </span>
      </div>

      {/* Waiting message */}
      {!allVoted && votingState === 'voting' && votedCount > 0 && (
        <p className="mt-4 text-xs text-center text-gray-400">
          Waiting for {totalParticipants - votedCount} more {totalParticipants - votedCount === 1 ? 'vote' : 'votes'}...
        </p>
      )}
    </div>
  );
}

/**
 * ParticipantList Component
 *
 * Displays all participants in the session.
 * Slate & Stone theme - clean roster display.
 */

interface Participant {
  participantId: string;
  name: string;
  emoji: string;
  isModerator: boolean;
  isConnected: boolean;
  hasVoted: boolean;
}

interface ParticipantListProps {
  participants: Participant[];
  currentParticipantId: string;
  onPromoteModerator?: (targetParticipantId: string) => void;
  isCurrentUserModerator?: boolean;
}

export function ParticipantList({
  participants,
  currentParticipantId,
  onPromoteModerator,
  isCurrentUserModerator = false
}: ParticipantListProps) {
  if (participants.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-slate-100 flex items-center justify-center">
          <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
          </svg>
        </div>
        <p className="text-slate-500 text-sm font-medium">No participants yet</p>
        <p className="text-slate-400 text-xs mt-1">Waiting for team members to join...</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {participants.map((participant) => {
        const isCurrentUser = participant.participantId === currentParticipantId;
        const canPromote = isCurrentUserModerator && !isCurrentUser && !participant.isModerator && participant.isConnected;

        return (
          <div
            key={participant.participantId}
            className={`
              relative p-3 rounded-lg transition-all duration-200
              participant-enter
              ${isCurrentUser
                ? 'bg-primary-50 border border-primary-200'
                : 'bg-white border border-slate-200 hover:border-slate-300'
              }
            `}
            data-testid={`participant-item-${participant.name.toLowerCase()}`}
          >
            <div className="flex items-center justify-between">
              {/* Participant Info */}
              <div className="flex items-center gap-3 min-w-0">
                {/* Avatar */}
                <div className="relative flex-shrink-0">
                  <div className={`
                    flex items-center justify-center
                    w-10 h-10 rounded-full text-lg
                    ${isCurrentUser
                      ? 'bg-primary-100'
                      : 'bg-slate-100'
                    }
                  `}>
                    <span>{participant.emoji}</span>
                  </div>

                  {/* Connection indicator */}
                  <div
                    className={`
                      absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full
                      border-2 border-white
                      ${participant.isConnected
                        ? 'bg-success-500'
                        : 'bg-slate-400'
                      }
                    `}
                    title={participant.isConnected ? 'Online' : 'Offline'}
                  />
                </div>

                {/* Name and Status */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`
                      font-medium text-sm truncate
                      ${isCurrentUser ? 'text-primary-700' : 'text-slate-900'}
                    `}>
                      {participant.name}
                    </span>

                    {isCurrentUser && (
                      <span className="badge badge-primary text-[10px] py-0.5">
                        You
                      </span>
                    )}

                    {participant.isModerator && (
                      <span
                        className="badge badge-warning text-[10px] py-0.5"
                        data-testid="moderator-badge"
                      >
                        Host
                      </span>
                    )}
                  </div>

                  {/* Status */}
                  <p
                    className="text-xs text-slate-500 mt-0.5"
                    data-testid={`participant-status-${participant.name.toLowerCase()}`}
                  >
                    {!participant.isConnected ? (
                      <span className="text-slate-400">Disconnected</span>
                    ) : participant.hasVoted ? (
                      <span className="text-success-600">Voted</span>
                    ) : (
                      <span className="text-warning-600">Thinking...</span>
                    )}
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {/* Voting Status Icon */}
                {participant.hasVoted && (
                  <div
                    className="flex items-center justify-center w-7 h-7 rounded-full bg-success-100 animate-fade-in"
                    title="Vote submitted"
                    data-testid={`participant-voted-${participant.name.toLowerCase()}`}
                  >
                    <svg className="w-4 h-4 text-success-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}

                {/* Waiting indicator */}
                {!participant.hasVoted && participant.isConnected && (
                  <div className="flex items-center justify-center w-7 h-7 rounded-full bg-slate-100">
                    <div className="w-2 h-2 rounded-full bg-warning-400 animate-pulse" />
                  </div>
                )}

                {/* Promote Button */}
                {canPromote && onPromoteModerator && (
                  <button
                    onClick={() => onPromoteModerator(participant.participantId)}
                    className="
                      flex items-center gap-1 text-xs font-medium px-2 py-1.5
                      rounded-md transition-all duration-200
                      bg-slate-100 text-slate-600
                      hover:bg-slate-200 hover:text-slate-800
                    "
                    data-testid={`promote-button-${participant.name.toLowerCase()}`}
                    title={`Make ${participant.name} a host`}
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
                    </svg>
                    Promote
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

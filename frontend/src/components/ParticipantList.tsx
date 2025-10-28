/**
 * ParticipantList Component
 *
 * Displays all participants in the session with:
 * - Name and emoji avatar
 * - Moderator badge
 * - Voting status indicator (checkmark when voted)
 * - Connection status
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
}

export function ParticipantList({ participants, currentParticipantId }: ParticipantListProps) {
  if (participants.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        <p>No participants yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {participants.map((participant) => {
        const isCurrentUser = participant.participantId === currentParticipantId;

        return (
          <div
            key={participant.participantId}
            className={`p-4 rounded-lg border transition-all ${
              isCurrentUser
                ? 'bg-blue-50 border-blue-300 shadow-sm'
                : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
            }`}
            data-testid={`participant-item-${participant.name.toLowerCase()}`}
          >
            <div className="flex items-center justify-between">
              {/* Participant Info */}
              <div className="flex items-center space-x-3">
                {/* Emoji Avatar */}
                <div className="text-3xl">{participant.emoji}</div>

                {/* Name and Badges */}
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-semibold text-gray-800">
                      {participant.name}
                      {isCurrentUser && (
                        <span className="ml-2 text-xs text-blue-600">(You)</span>
                      )}
                    </span>

                    {/* Moderator Badge */}
                    {participant.isModerator && (
                      <span
                        className="text-xs bg-yellow-400 text-yellow-900 px-2 py-0.5 rounded-full font-medium"
                        data-testid="moderator-badge"
                      >
                        Moderator
                      </span>
                    )}
                  </div>

                  {/* Connection Status */}
                  <div className="flex items-center space-x-1 mt-1">
                    <div
                      className={`w-2 h-2 rounded-full ${
                        participant.isConnected ? 'bg-green-500' : 'bg-gray-400'
                      }`}
                    />
                    <span
                      className="text-xs text-gray-500"
                      data-testid={`participant-status-${participant.name.toLowerCase()}`}
                    >
                      {participant.isConnected ? 'online' : 'offline'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Voting Status Indicator */}
              <div className="flex items-center">
                {participant.hasVoted && (
                  <div
                    className="flex items-center justify-center w-8 h-8 bg-green-500 rounded-full"
                    title="Has voted"
                    data-testid={`participant-voted-${participant.name.toLowerCase()}`}
                  >
                    <svg
                      className="w-5 h-5 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

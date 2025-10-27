import { useState, useEffect, useCallback } from 'react';
import { Socket } from 'socket.io-client';

/**
 * useVoting Hook
 *
 * Manages voting state and WebSocket events for Planning Poker voting.
 * Handles vote casting, vote counting, vote revealing, and vote resetting.
 */

type CardValue = 1 | 2 | 3 | 5 | 8 | 13 | 21 | '?';

interface VoteData {
  participantId: string;
  participantName: string;
  participantEmoji: string;
  cardValue: CardValue;
}

interface VoteStatistics {
  consensus: boolean;
  averageNumeric: number | null;
  distribution: Record<string, number>;
}

interface VotingState {
  selectedCard: CardValue | null;
  votedCount: number;
  totalParticipants: number;
  hasVoted: Record<string, boolean>;
  votingPhase: 'voting' | 'revealed';
  revealedVotes: VoteData[];
  statistics: VoteStatistics | null;
}

interface UseVotingProps {
  socket: Socket | null;
  sessionId: string | null;
  participantId: string | null;
}

export function useVoting({ socket, sessionId, participantId }: UseVotingProps) {
  const [votingState, setVotingState] = useState<VotingState>({
    selectedCard: null,
    votedCount: 0,
    totalParticipants: 0,
    hasVoted: {},
    votingPhase: 'voting',
    revealedVotes: [],
    statistics: null,
  });

  const [isVoting, setIsVoting] = useState(false);

  /**
   * Cast or change a vote
   */
  const castVote = useCallback((cardValue: CardValue) => {
    if (!socket || !sessionId || !participantId || votingState.votingPhase === 'revealed') {
      return;
    }

    setIsVoting(true);

    socket.emit('cast-vote', {
      sessionId,
      participantId,
      cardValue,
    });
  }, [socket, sessionId, participantId, votingState.votingPhase]);

  /**
   * Reveal all votes (moderator only)
   */
  const revealVotes = useCallback(() => {
    if (!socket || !sessionId || !participantId) {
      return;
    }

    socket.emit('reveal-votes', {
      sessionId,
      moderatorId: participantId,
    });
  }, [socket, sessionId, participantId]);

  /**
   * Reset votes for a new round (moderator only)
   */
  const resetVotes = useCallback(() => {
    if (!socket || !sessionId || !participantId) {
      return;
    }

    socket.emit('reset-votes', {
      sessionId,
      moderatorId: participantId,
    });
  }, [socket, sessionId, participantId]);

  /**
   * Set up WebSocket event listeners
   */
  useEffect(() => {
    if (!socket) return;

    // Vote accepted - update local selected card
    const handleVoteAccepted = (data: { cardValue: CardValue; timestamp: number }) => {
      setVotingState(prev => ({
        ...prev,
        selectedCard: data.cardValue,
      }));
      setIsVoting(false);
    };

    // Vote count updated - update counts and who has voted
    const handleVoteCountUpdated = (data: {
      votedCount: number;
      totalParticipants: number;
      hasVoted: Record<string, boolean>;
      timestamp: number;
    }) => {
      setVotingState(prev => ({
        ...prev,
        votedCount: data.votedCount,
        totalParticipants: data.totalParticipants,
        hasVoted: data.hasVoted,
      }));
    };

    // Votes revealed - show all votes and statistics
    const handleVotesRevealed = (data: {
      votes: VoteData[];
      statistics: VoteStatistics;
      timestamp: number;
    }) => {
      setVotingState(prev => ({
        ...prev,
        votingPhase: 'revealed',
        revealedVotes: data.votes,
        statistics: data.statistics,
      }));
    };

    // Votes reset - clear everything for new round
    const handleVotesReset = () => {
      setVotingState(prev => ({
        ...prev,
        selectedCard: null,
        votedCount: 0,
        hasVoted: {},
        votingPhase: 'voting',
        revealedVotes: [],
        statistics: null,
      }));
    };

    // Handle errors
    const handleError = (error: { code: string; message: string }) => {
      console.error('Voting error:', error);
      setIsVoting(false);

      // Show user-friendly error messages
      if (error.code === 'ALREADY_REVEALED') {
        alert('Votes have already been revealed. Please wait for the moderator to reset.');
      } else if (error.code === 'NOT_MODERATOR') {
        alert('Only moderators can perform this action.');
      } else if (error.code === 'NO_VOTES') {
        alert('No votes to reveal yet.');
      } else {
        alert(error.message || 'An error occurred. Please try again.');
      }
    };

    // Register event listeners
    socket.on('vote-accepted', handleVoteAccepted);
    socket.on('vote-count-updated', handleVoteCountUpdated);
    socket.on('votes-revealed', handleVotesRevealed);
    socket.on('votes-reset', handleVotesReset);
    socket.on('error', handleError);

    // Cleanup
    return () => {
      socket.off('vote-accepted', handleVoteAccepted);
      socket.off('vote-count-updated', handleVoteCountUpdated);
      socket.off('votes-revealed', handleVotesRevealed);
      socket.off('votes-reset', handleVotesReset);
      socket.off('error', handleError);
    };
  }, [socket]);

  return {
    // State
    selectedCard: votingState.selectedCard,
    votedCount: votingState.votedCount,
    totalParticipants: votingState.totalParticipants,
    hasVoted: votingState.hasVoted,
    votingPhase: votingState.votingPhase,
    revealedVotes: votingState.revealedVotes,
    statistics: votingState.statistics,
    isVoting,

    // Actions
    castVote,
    revealVotes,
    resetVotes,
  };
}

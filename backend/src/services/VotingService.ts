import type { Session } from '../models/Session.js';
import type { Vote, VoteRound, VoteStatistics, CastVoteParams, RevealedVotesData } from '../models/Vote.js';
import type { CardValue } from '../config/constants.js';

/**
 * VotingService
 *
 * Handles vote casting, revealing, resetting, and statistics calculation.
 */
export class VotingService {
  /**
   * Cast a vote in the current round
   */
  castVote(session: Session, params: CastVoteParams): void {
    const participant = session.participants.get(params.participantId);
    if (!participant) {
      throw new Error('Participant not found');
    }

    if (session.votingState === 'revealed') {
      throw new Error('Votes already revealed, reset to vote again');
    }

    // Create or update vote
    const vote: Vote = {
      participantId: params.participantId,
      participantName: participant.name,
      participantEmoji: participant.emoji,
      cardValue: params.cardValue,
      votedAt: Date.now(),
      revealed: false,
    };

    session.votes.set(params.participantId, vote);
    participant.hasVoted = true;
    participant.currentVote = params.cardValue;
    session.lastActivityAt = Date.now();
  }

  /**
   * Reveal all votes (moderator only)
   */
  revealVotes(session: Session, moderatorId: string): RevealedVotesData {
    if (!session.moderatorIds.has(moderatorId)) {
      throw new Error('Only moderators can reveal votes');
    }

    if (session.votes.size === 0) {
      throw new Error('No votes to reveal');
    }

    // Mark all votes as revealed
    const votes: Vote[] = [];
    session.votes.forEach((vote) => {
      vote.revealed = true;
      votes.push(vote);
    });

    session.votingState = 'revealed';
    session.lastActivityAt = Date.now();

    // Calculate statistics
    const statistics = this.calculateStatistics(session);

    return {
      votes,
      statistics: {
        totalVotes: statistics.totalVotes,
        totalParticipants: statistics.totalParticipants,
        consensus: statistics.consensus,
        averageNumeric: statistics.averageNumeric,
        medianNumeric: statistics.medianNumeric,
        voteDistribution: Object.fromEntries(statistics.voteDistribution),
      },
    };
  }

  /**
   * Reset votes for a new round (moderator only)
   */
  resetVotes(session: Session, moderatorId: string): void {
    if (!session.moderatorIds.has(moderatorId)) {
      throw new Error('Only moderators can reset votes');
    }

    // Archive current round to history
    if (session.votes.size > 0) {
      const votes = Array.from(session.votes.values());
      const numericVotes = votes
        .filter((v) => typeof v.cardValue === 'number')
        .map((v) => v.cardValue as number);

      const voteRound: VoteRound = {
        roundNumber: session.voteHistory.length + 1,
        completedAt: Date.now(),
        storyDescription: session.storyDescription,
        votes,
        consensus: new Set(votes.map((v) => v.cardValue)).size === 1,
        averageVote:
          numericVotes.length > 0
            ? numericVotes.reduce((a, b) => a + b, 0) / numericVotes.length
            : null,
      };

      session.voteHistory.push(voteRound);
    }

    // Clear current round
    session.votes.clear();
    session.votingState = 'voting';
    session.participants.forEach((p) => {
      p.hasVoted = false;
      p.currentVote = null;
    });
    session.lastActivityAt = Date.now();
  }

  /**
   * Calculate vote statistics
   */
  calculateStatistics(session: Session): VoteStatistics {
    const votes = Array.from(session.votes.values());
    const numericVotes = votes
      .filter((v) => typeof v.cardValue === 'number')
      .map((v) => v.cardValue as number)
      .sort((a, b) => a - b);

    // Vote distribution
    const voteDistribution = new Map<CardValue, number>();
    votes.forEach((vote) => {
      const count = voteDistribution.get(vote.cardValue) || 0;
      voteDistribution.set(vote.cardValue, count + 1);
    });

    // Consensus check
    const uniqueVotes = new Set(votes.map((v) => v.cardValue));
    const consensus = uniqueVotes.size === 1;

    // Average calculation
    const averageNumeric =
      numericVotes.length > 0
        ? numericVotes.reduce((a, b) => a + b, 0) / numericVotes.length
        : null;

    // Median calculation
    const medianNumeric =
      numericVotes.length > 0
        ? numericVotes.length % 2 === 0
          ? (numericVotes[numericVotes.length / 2 - 1] + numericVotes[numericVotes.length / 2]) / 2
          : numericVotes[Math.floor(numericVotes.length / 2)]
        : null;

    return {
      totalVotes: votes.length,
      totalParticipants: session.participantCount,
      voteDistribution,
      consensus,
      averageNumeric,
      medianNumeric,
    };
  }

  /**
   * Get vote count (without revealing values)
   * Excludes spectators from the total count
   */
  getVoteCount(session: Session): { voted: number; total: number } {
    const voters = Array.from(session.participants.values()).filter(p => !p.isSpectator);
    return {
      voted: session.votes.size,
      total: voters.length,
    };
  }

  /**
   * Get the number of participants who can vote (non-spectators)
   */
  getVoterCount(session: Session): number {
    return Array.from(session.participants.values()).filter(p => !p.isSpectator).length;
  }
}

// Export singleton instance
export const votingService = new VotingService();

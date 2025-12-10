import ExcelJS from 'exceljs';
import type { Session } from '../models/Session.js';

/**
 * ExportService
 *
 * Generates Excel exports of session data per FR-024, FR-025.
 * Creates a 2-sheet workbook:
 * - Sheet 1: "Session Summary" - Session info and participants
 * - Sheet 2: "Voting Rounds" - All votes grouped by round
 */
export class ExportService {
  /**
   * Generate Excel file for session export
   *
   * @param session - Session to export
   * @returns Buffer containing the Excel file
   */
  async generateExcel(session: Session): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Planning Poker';
    workbook.created = new Date();

    // Create Session Summary sheet
    this.createSummarySheet(workbook, session);

    // Create Voting Rounds sheet
    this.createVotingRoundsSheet(workbook, session);

    // Write to buffer
    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  /**
   * Create the Session Summary sheet
   */
  private createSummarySheet(workbook: ExcelJS.Workbook, session: Session): void {
    const sheet = workbook.addWorksheet('Session Summary');

    // Style configuration
    const headerStyle: Partial<ExcelJS.Style> = {
      font: { bold: true, size: 12 },
      fill: {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF3B82F6' }
      },
      font: { bold: true, color: { argb: 'FFFFFFFF' } }
    };

    const labelStyle: Partial<ExcelJS.Style> = {
      font: { bold: true }
    };

    // Session Information Section
    sheet.mergeCells('A1:B1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = 'Session Information';
    titleCell.style = headerStyle;

    const sessionInfo = [
      ['Session ID', session.sessionId],
      ['Created', new Date(session.createdAt).toISOString()],
      ['Total Rounds', session.voteHistory.length],
      ['Participants', session.participantCount]
    ];

    sessionInfo.forEach((row, index) => {
      const labelCell = sheet.getCell(`A${index + 2}`);
      labelCell.value = row[0];
      labelCell.style = labelStyle;
      sheet.getCell(`B${index + 2}`).value = row[1];
    });

    // Participants Section
    const participantsStartRow = sessionInfo.length + 3;

    sheet.mergeCells(`A${participantsStartRow}:C${participantsStartRow}`);
    const participantsTitleCell = sheet.getCell(`A${participantsStartRow}`);
    participantsTitleCell.value = 'Participants';
    participantsTitleCell.style = headerStyle;

    // Participants header row
    const participantsHeaderRow = participantsStartRow + 1;
    ['Name', 'Emoji', 'Role'].forEach((header, col) => {
      const cell = sheet.getCell(participantsHeaderRow, col + 1);
      cell.value = header;
      cell.style = { font: { bold: true } };
    });

    // Participant data rows
    const participants = Array.from(session.participants.values());
    participants.forEach((participant, index) => {
      const rowNum = participantsHeaderRow + index + 1;
      sheet.getCell(rowNum, 1).value = participant.name;
      sheet.getCell(rowNum, 2).value = participant.emoji;
      sheet.getCell(rowNum, 3).value = participant.isModerator ? 'Moderator' : 'Participant';
    });

    // Auto-width columns
    sheet.columns.forEach(column => {
      column.width = 20;
    });
  }

  /**
   * Create the Voting Rounds sheet
   */
  private createVotingRoundsSheet(workbook: ExcelJS.Workbook, session: Session): void {
    const sheet = workbook.addWorksheet('Voting Rounds');

    // Header row
    const headers = ['Round', 'Story', 'Participant', 'Vote', 'Timestamp'];
    const headerRow = sheet.addRow(headers);
    headerRow.eachCell(cell => {
      cell.style = {
        font: { bold: true, color: { argb: 'FFFFFFFF' } },
        fill: {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF3B82F6' }
        }
      };
    });

    // Add current round votes if revealed
    if (session.votingState === 'revealed' && session.votes.size > 0) {
      const currentRoundNumber = session.voteHistory.length + 1;

      session.votes.forEach(vote => {
        sheet.addRow([
          currentRoundNumber,
          session.storyDescription,
          `${vote.participantName} ${vote.participantEmoji}`,
          vote.cardValue,
          new Date(vote.votedAt).toISOString()
        ]);
      });

      // Add round summary
      const numericVotes = Array.from(session.votes.values())
        .filter(v => typeof v.cardValue === 'number')
        .map(v => v.cardValue as number);

      const average = numericVotes.length > 0
        ? (numericVotes.reduce((a, b) => a + b, 0) / numericVotes.length).toFixed(1)
        : 'N/A';

      const uniqueVotes = new Set(Array.from(session.votes.values()).map(v => v.cardValue));
      const consensus = uniqueVotes.size === 1 ? 'Yes' : 'No';

      // Add summary rows with bold styling
      const avgRow = sheet.addRow([currentRoundNumber, 'Average', '', average, '']);
      avgRow.eachCell(cell => { cell.style = { font: { bold: true } }; });

      const consensusRow = sheet.addRow([currentRoundNumber, 'Consensus', '', consensus, '']);
      consensusRow.eachCell(cell => { cell.style = { font: { bold: true } }; });

      // Add empty row between rounds
      sheet.addRow([]);
    }

    // Add historical rounds
    session.voteHistory.forEach((round, index) => {
      round.votes.forEach(vote => {
        sheet.addRow([
          round.roundNumber,
          round.storyDescription,
          `${vote.participantName} ${vote.participantEmoji}`,
          vote.cardValue,
          new Date(vote.votedAt).toISOString()
        ]);
      });

      // Add round summary
      const average = round.averageVote !== null ? round.averageVote.toFixed(1) : 'N/A';
      const consensus = round.consensus ? 'Yes' : 'No';

      const avgRow = sheet.addRow([round.roundNumber, 'Average', '', average, '']);
      avgRow.eachCell(cell => { cell.style = { font: { bold: true } }; });

      const consensusRow = sheet.addRow([round.roundNumber, 'Consensus', '', consensus, '']);
      consensusRow.eachCell(cell => { cell.style = { font: { bold: true } }; });

      // Add empty row between rounds (except after last)
      if (index < session.voteHistory.length - 1) {
        sheet.addRow([]);
      }
    });

    // If no voting data, add a message
    if (session.votes.size === 0 && session.voteHistory.length === 0) {
      sheet.addRow(['No voting data', '', '', '', '']);
    }

    // Auto-width columns
    sheet.columns = [
      { width: 10 },  // Round
      { width: 30 },  // Story
      { width: 20 },  // Participant
      { width: 10 },  // Vote
      { width: 25 }   // Timestamp
    ];
  }
}

// Export singleton instance
export const exportService = new ExportService();

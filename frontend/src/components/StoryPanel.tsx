import { useState, useEffect } from 'react';

/**
 * Story details interface matching the shared StoryDetails type
 */
interface StoryDetails {
  title: string;
  description: string;
  acceptanceCriteria: string;
  ticketLink: string;
}

interface StoryPanelProps {
  story: StoryDetails;
  isModerator: boolean;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  onStoryUpdate?: (story: StoryDetails) => void;
}

const VALIDATION = {
  TITLE_MAX_LENGTH: 100,
  DESCRIPTION_MAX_LENGTH: 500,
  ACCEPTANCE_CRITERIA_MAX_LENGTH: 1000,
  TICKET_LINK_MAX_LENGTH: 2000,
} as const;

/**
 * StoryPanel Component
 *
 * Displays story details with inline editing for moderators.
 * Compact by default, expandable for full details.
 */
export function StoryPanel({
  story,
  isModerator,
  isExpanded = false,
  onToggleExpand,
  onStoryUpdate,
}: StoryPanelProps) {
  const [editingField, setEditingField] = useState<keyof StoryDetails | null>(null);
  const [editValue, setEditValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleStartEdit = (field: keyof StoryDetails) => {
    if (!isModerator) return;
    setEditingField(field);
    setEditValue(story[field]);
    setError(null);
  };

  const handleCancelEdit = () => {
    setEditingField(null);
    setEditValue('');
    setError(null);
  };

  const handleSaveEdit = () => {
    if (!editingField || !onStoryUpdate) return;

    const maxLength = getMaxLength(editingField);
    if (editValue.length > maxLength) {
      setError(`Maximum ${maxLength} characters allowed`);
      return;
    }

    // Validate URL for ticket link
    if (editingField === 'ticketLink' && editValue.trim()) {
      try {
        new URL(editValue.trim());
      } catch {
        setError('Please enter a valid URL');
        return;
      }
    }

    const updatedStory = { ...story, [editingField]: editValue.trim() };
    onStoryUpdate(updatedStory);
    setEditingField(null);
    setEditValue('');
    setError(null);
  };

  const getMaxLength = (field: keyof StoryDetails): number => {
    switch (field) {
      case 'title': return VALIDATION.TITLE_MAX_LENGTH;
      case 'description': return VALIDATION.DESCRIPTION_MAX_LENGTH;
      case 'acceptanceCriteria': return VALIDATION.ACCEPTANCE_CRITERIA_MAX_LENGTH;
      case 'ticketLink': return VALIDATION.TICKET_LINK_MAX_LENGTH;
      default: return 500;
    }
  };

  // Handle keyboard shortcuts
  useEffect(() => {
    if (!editingField) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleCancelEdit();
      } else if (e.key === 'Enter' && !e.shiftKey && editingField !== 'description' && editingField !== 'acceptanceCriteria') {
        e.preventDefault();
        handleSaveEdit();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editingField, editValue]);

  // Compact view - just shows title/description if available
  if (!isExpanded) {
    return (
      <div
        className="flex-shrink-0 mb-3 p-3 rounded-lg bg-slate-50 border border-slate-200 cursor-pointer hover:bg-slate-100 transition-colors group"
        onClick={onToggleExpand}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && onToggleExpand?.()}
        aria-expanded={isExpanded}
        data-testid="story-panel-compact"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            {story.title ? (
              <h3 className="text-sm font-medium text-slate-900 truncate">{story.title}</h3>
            ) : (
              <h3 className="text-sm font-medium text-slate-400 italic">
                {isModerator ? 'Click to add story details...' : 'No story details'}
              </h3>
            )}
            {story.description && (
              <p className="text-xs text-slate-600 mt-1 line-clamp-2">{story.description}</p>
            )}
          </div>
          <svg
            className="w-4 h-4 text-slate-400 flex-shrink-0 transition-transform group-hover:text-slate-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
        {story.ticketLink && (
          <a
            href={story.ticketLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 mt-2"
            onClick={(e) => e.stopPropagation()}
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            View ticket
          </a>
        )}
      </div>
    );
  }

  // Expanded view - shows all fields with editing
  return (
    <div
      className="flex-shrink-0 mb-3 p-4 rounded-lg bg-white border border-slate-200 shadow-sm"
      data-testid="story-panel-expanded"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
          <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Story Details
        </h3>
        <button
          onClick={onToggleExpand}
          className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
          aria-label="Collapse story details"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
          </svg>
        </button>
      </div>

      {/* Fields */}
      <div className="space-y-4">
        {/* Title */}
        <EditableField
          label="Title"
          value={story.title}
          placeholder="Enter story title..."
          isEditing={editingField === 'title'}
          editValue={editValue}
          maxLength={VALIDATION.TITLE_MAX_LENGTH}
          canEdit={isModerator}
          error={editingField === 'title' ? error : null}
          onStartEdit={() => handleStartEdit('title')}
          onChangeEdit={setEditValue}
          onSaveEdit={handleSaveEdit}
          onCancelEdit={handleCancelEdit}
          multiline={false}
          data-testid="story-title-field"
        />

        {/* Description */}
        <EditableField
          label="Description"
          value={story.description}
          placeholder="Enter story description..."
          isEditing={editingField === 'description'}
          editValue={editValue}
          maxLength={VALIDATION.DESCRIPTION_MAX_LENGTH}
          canEdit={isModerator}
          error={editingField === 'description' ? error : null}
          onStartEdit={() => handleStartEdit('description')}
          onChangeEdit={setEditValue}
          onSaveEdit={handleSaveEdit}
          onCancelEdit={handleCancelEdit}
          multiline={true}
          data-testid="story-description-field"
        />

        {/* Acceptance Criteria */}
        <EditableField
          label="Acceptance Criteria"
          value={story.acceptanceCriteria}
          placeholder="Enter acceptance criteria..."
          isEditing={editingField === 'acceptanceCriteria'}
          editValue={editValue}
          maxLength={VALIDATION.ACCEPTANCE_CRITERIA_MAX_LENGTH}
          canEdit={isModerator}
          error={editingField === 'acceptanceCriteria' ? error : null}
          onStartEdit={() => handleStartEdit('acceptanceCriteria')}
          onChangeEdit={setEditValue}
          onSaveEdit={handleSaveEdit}
          onCancelEdit={handleCancelEdit}
          multiline={true}
          data-testid="story-ac-field"
        />

        {/* Ticket Link */}
        <EditableField
          label="Ticket Link"
          value={story.ticketLink}
          placeholder="https://..."
          isEditing={editingField === 'ticketLink'}
          editValue={editValue}
          maxLength={VALIDATION.TICKET_LINK_MAX_LENGTH}
          canEdit={isModerator}
          error={editingField === 'ticketLink' ? error : null}
          onStartEdit={() => handleStartEdit('ticketLink')}
          onChangeEdit={setEditValue}
          onSaveEdit={handleSaveEdit}
          onCancelEdit={handleCancelEdit}
          multiline={false}
          isLink={true}
          data-testid="story-ticket-field"
        />
      </div>

      {/* Moderator hint */}
      {isModerator && !editingField && (
        <p className="text-[10px] text-slate-400 mt-4 text-center">
          Click any field to edit
        </p>
      )}
    </div>
  );
}

/**
 * EditableField Component
 *
 * Individual editable field with view/edit modes
 */
interface EditableFieldProps {
  label: string;
  value: string;
  placeholder: string;
  isEditing: boolean;
  editValue: string;
  maxLength: number;
  canEdit: boolean;
  error: string | null;
  onStartEdit: () => void;
  onChangeEdit: (value: string) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  multiline?: boolean;
  isLink?: boolean;
  'data-testid'?: string;
}

function EditableField({
  label,
  value,
  placeholder,
  isEditing,
  editValue,
  maxLength,
  canEdit,
  error,
  onStartEdit,
  onChangeEdit,
  onSaveEdit,
  onCancelEdit,
  multiline = false,
  isLink = false,
  'data-testid': testId,
}: EditableFieldProps) {
  if (isEditing) {
    return (
      <div className="space-y-1" data-testid={testId}>
        <label className="block text-xs font-medium text-slate-700">{label}</label>
        {multiline ? (
          <textarea
            value={editValue}
            onChange={(e) => onChangeEdit(e.target.value)}
            placeholder={placeholder}
            maxLength={maxLength}
            rows={3}
            className={`
              w-full px-3 py-2 text-sm rounded-md border
              focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
              ${error ? 'border-error-500' : 'border-slate-300'}
            `}
            autoFocus
            data-testid={`${testId}-textarea`}
          />
        ) : (
          <input
            type={isLink ? 'url' : 'text'}
            value={editValue}
            onChange={(e) => onChangeEdit(e.target.value)}
            placeholder={placeholder}
            maxLength={maxLength}
            className={`
              w-full px-3 py-2 text-sm rounded-md border
              focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
              ${error ? 'border-error-500' : 'border-slate-300'}
            `}
            autoFocus
            data-testid={`${testId}-input`}
          />
        )}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {error && (
              <p className="text-xs text-error-600">{error}</p>
            )}
            <span className="text-[10px] text-slate-400">
              {editValue.length}/{maxLength}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={onCancelEdit}
              className="px-2 py-1 text-xs text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded transition-colors"
              data-testid={`${testId}-cancel`}
            >
              Cancel
            </button>
            <button
              onClick={onSaveEdit}
              className="px-2 py-1 text-xs bg-primary-500 text-white hover:bg-primary-600 rounded transition-colors"
              data-testid={`${testId}-save`}
            >
              Save
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`group ${canEdit ? 'cursor-pointer' : ''}`}
      onClick={canEdit ? onStartEdit : undefined}
      role={canEdit ? 'button' : undefined}
      tabIndex={canEdit ? 0 : undefined}
      onKeyDown={canEdit ? (e) => e.key === 'Enter' && onStartEdit() : undefined}
      data-testid={testId}
    >
      <label className="block text-xs font-medium text-slate-500 mb-1">{label}</label>
      {value ? (
        <div className="flex items-start justify-between gap-2">
          {isLink ? (
            <a
              href={value}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary-600 hover:text-primary-700 break-all"
              onClick={(e) => e.stopPropagation()}
            >
              {value}
            </a>
          ) : (
            <p className="text-sm text-slate-900 whitespace-pre-wrap">{value}</p>
          )}
          {canEdit && (
            <svg
              className="w-3.5 h-3.5 text-slate-300 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          )}
        </div>
      ) : (
        <p className={`text-sm italic ${canEdit ? 'text-slate-400 group-hover:text-slate-500' : 'text-slate-300'}`}>
          {canEdit ? placeholder : 'Not specified'}
        </p>
      )}
    </div>
  );
}

export default StoryPanel;

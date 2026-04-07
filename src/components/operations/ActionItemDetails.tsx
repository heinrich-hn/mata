import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Modal from '@/components/ui/modal';
import { Textarea } from '@/components/ui/textarea';
import { ActionItem, ActionItemProgressLine } from '@/types/operations';
import { emailActionItem } from '@/utils/icsExport';
import { formatDate } from 'date-fns';
import {
    Calendar,
    CheckCircle,
    Circle,
    Clock,
    ListChecks,
    Mail,
    MessageSquare,
    Plus,
    Send,
    Trash2,
    User,
    X
} from 'lucide-react';
import { useState } from 'react';

interface ActionItemDetailsProps {
  isOpen: boolean;
  onClose: () => void;
  actionItem: ActionItem;
  onStatusChange: (item: ActionItem, newStatus: ActionItem['status']) => void;
  onAddComment: (item: ActionItem, comment: string) => void;
  onUpdateProgressLines: (item: ActionItem, lines: ActionItemProgressLine[]) => void;
}

const ActionItemDetails = ({
  isOpen,
  onClose,
  actionItem,
  onStatusChange,
  onAddComment,
  onUpdateProgressLines
}: ActionItemDetailsProps) => {
  const [comment, setComment] = useState('');
  const [newLineNote, setNewLineNote] = useState('');
  const [newLineDate, setNewLineDate] = useState('');
  const [showAddLine, setShowAddLine] = useState(false);

  // Calculate overdue status
  const today = new Date();
  const dueDate = actionItem.due_date ? new Date(actionItem.due_date) : null;
  const isOverdue = dueDate && today > dueDate && actionItem.status !== 'completed';
  const overdueBy = isOverdue && dueDate ? Math.floor((today.getTime() - dueDate.getTime()) / (86400000)) : 0;

  const progressLines = actionItem.progress_lines || [];
  const completedLines = progressLines.filter(l => l.completed).length;

  const handleAddComment = () => {
    if (!comment.trim()) return;
    onAddComment(actionItem, comment.trim());
    setComment('');
  };

  const handleAddProgressLine = () => {
    if (!newLineNote.trim()) return;
    const newLine: ActionItemProgressLine = {
      id: crypto.randomUUID(),
      action_item_id: actionItem.id,
      note: newLineNote.trim(),
      target_date: newLineDate || undefined,
      completed: false,
      created_by: 'Current User',
      created_at: new Date().toISOString()
    };
    onUpdateProgressLines(actionItem, [...progressLines, newLine]);
    setNewLineNote('');
    setNewLineDate('');
    setShowAddLine(false);
  };

  const handleToggleLine = (lineId: string) => {
    const updated = progressLines.map(l =>
      l.id === lineId ? { ...l, completed: !l.completed } : l
    );
    onUpdateProgressLines(actionItem, updated);
  };

  const handleDeleteLine = (lineId: string) => {
    const updated = progressLines.filter(l => l.id !== lineId);
    onUpdateProgressLines(actionItem, updated);
  };

  const getStatusColor = () => {
    switch (actionItem.status) {
      case 'completed': return 'bg-success/10 text-success border-success/20';
      case 'in_progress': return 'bg-primary/10 text-primary border-primary/20';
      case 'cancelled': return 'bg-muted text-muted-foreground border-border';
      default: return 'bg-warning/10 text-warning border-warning/20';
    }
  };

  const getStatusLabel = () => {
    switch (actionItem.status) {
      case 'in_progress': return 'In Progress';
      case 'completed': return 'Completed';
      case 'cancelled': return 'Cancelled';
      default: return 'Open';
    }
  };

  const getPriorityColor = () => {
    switch (actionItem.priority) {
      case 'urgent': return 'bg-destructive/10 text-destructive';
      case 'high': return 'bg-warning/10 text-warning';
      case 'medium': return 'bg-primary/10 text-primary';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Action Item Details"
      maxWidth="lg"
    >
      <div className="space-y-6">
        {/* Header */}
        <div className={`p-4 rounded-lg border ${getStatusColor()}`}>
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <h3 className="text-lg font-semibold">{actionItem.title}</h3>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${getStatusColor()}`}>
                  {getStatusLabel()}
                </span>
                <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${getPriorityColor()}`}>
                  {actionItem.priority.charAt(0).toUpperCase() + actionItem.priority.slice(1)}
                </span>
                {isOverdue && (
                  <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-destructive/10 text-destructive">
                    Overdue by {overdueBy} days
                  </span>
                )}
                {progressLines.length > 0 && (
                  <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-muted text-muted-foreground">
                    <ListChecks className="w-3 h-3 mr-1" />
                    {completedLines}/{progressLines.length} lines
                  </span>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => emailActionItem(actionItem)}
                title="Email to assigned user"
              >
                <Mail className="w-3 h-3 mr-1" />
                Email
              </Button>

              {actionItem.status !== 'completed' && actionItem.status !== 'cancelled' && (
                <Button
                  size="sm"
                  onClick={() => onStatusChange(
                    actionItem,
                    actionItem.status === 'open' ? 'in_progress' : 'completed'
                  )}
                >
                  {actionItem.status === 'open' ? (
                    <>
                      <Clock className="w-3 h-3 mr-1" />
                      Start
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Complete
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            {actionItem.description && (
              <div>
                <h4 className="text-sm font-medium text-muted-foreground">Description</h4>
                <p className="mt-1 text-sm">{actionItem.description}</p>
              </div>
            )}

            {actionItem.assigned_to && (
              <div className="flex items-center gap-3">
                <User className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Assigned To</p>
                  <p className="font-medium">{actionItem.assigned_to}</p>
                </div>
              </div>
            )}

            {actionItem.category && (
              <div>
                <p className="text-sm text-muted-foreground">Category</p>
                <p className="font-medium">{actionItem.category}</p>
              </div>
            )}
          </div>

          <div className="space-y-4">
            {actionItem.due_date && (
              <div className="flex items-center gap-3">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Due Date</p>
                  <p className={`font-medium ${isOverdue ? 'text-destructive' : ''}`}>
                    {formatDate(new Date(actionItem.due_date), 'PPP')}
                  </p>
                </div>
              </div>
            )}

            {actionItem.completed_date && (
              <div className="flex items-center gap-3">
                <CheckCircle className="w-4 h-4 text-success" />
                <div>
                  <p className="text-sm text-muted-foreground">Completed</p>
                  <p className="font-medium">{formatDate(new Date(actionItem.completed_date), 'PPP')}</p>
                </div>
              </div>
            )}

            <div>
              <p className="text-sm text-muted-foreground">Created By</p>
              <p className="font-medium">{actionItem.created_by}</p>
              <p className="text-xs text-muted-foreground">{formatDate(new Date(actionItem.created_at), 'PPP')}</p>
            </div>
          </div>
        </div>

        {/* Progress Lines */}
        <div className="border rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <ListChecks className="w-4 h-4" />
              Progress Lines ({completedLines}/{progressLines.length})
            </h4>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowAddLine(!showAddLine)}
            >
              <Plus className="w-3 h-3 mr-1" />
              Add Line
            </Button>
          </div>

          {/* Progress bar */}
          {progressLines.length > 0 && (
            <div className="w-full bg-muted rounded-full h-2 mb-4">
              <div
                className="bg-success h-2 rounded-full transition-all"
                style={{ width: `${(completedLines / progressLines.length) * 100}%` }}
              />
            </div>
          )}

          {/* Add new line form */}
          {showAddLine && (
            <div className="flex gap-2 mb-4 items-end p-3 bg-muted/50 rounded-md">
              <div className="flex-1">
                <label className="text-xs text-muted-foreground mb-1 block">Note *</label>
                <Input
                  value={newLineNote}
                  onChange={(e) => setNewLineNote(e.target.value)}
                  placeholder="What needs to be tracked..."
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAddProgressLine(); }}
                />
              </div>
              <div className="w-40">
                <label className="text-xs text-muted-foreground mb-1 block">Target Date</label>
                <Input
                  type="date"
                  value={newLineDate}
                  onChange={(e) => setNewLineDate(e.target.value)}
                />
              </div>
              <Button onClick={handleAddProgressLine} disabled={!newLineNote.trim()} size="sm">
                <Plus className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => { setShowAddLine(false); setNewLineNote(''); setNewLineDate(''); }}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          )}

          {/* Lines list */}
          {progressLines.length > 0 ? (
            <div className="space-y-2">
              {progressLines.map((line) => {
                const lineTargetDate = line.target_date ? new Date(line.target_date) : null;
                const lineOverdue = lineTargetDate && new Date() > lineTargetDate && !line.completed;
                return (
                  <div
                    key={line.id}
                    className={`flex items-start gap-3 p-2 rounded-md group hover:bg-muted/50 transition-colors ${line.completed ? 'opacity-60' : ''} ${lineOverdue ? 'bg-destructive/5' : ''}`}
                  >
                    <button
                      onClick={() => handleToggleLine(line.id)}
                      className="mt-0.5 shrink-0"
                      title={line.completed ? 'Mark incomplete' : 'Mark complete'}
                    >
                      {line.completed ? (
                        <CheckCircle className="w-5 h-5 text-success" />
                      ) : (
                        <Circle className="w-5 h-5 text-muted-foreground hover:text-primary" />
                      )}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${line.completed ? 'line-through text-muted-foreground' : ''}`}>
                        {line.note}
                      </p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        {line.target_date && (
                          <span className={`flex items-center gap-1 ${lineOverdue ? 'text-destructive font-medium' : ''}`}>
                            <Calendar className="w-3 h-3" />
                            {formatDate(new Date(line.target_date), 'PP')}
                            {lineOverdue && ' (overdue)'}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {line.created_by}
                        </span>
                        <span>{formatDate(new Date(line.created_at), 'PP')}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteLine(line.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                      title="Remove line"
                    >
                      <Trash2 className="w-4 h-4 text-muted-foreground hover:text-destructive" />
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              No progress lines yet. Add lines to track specific tasks or milestones.
            </p>
          )}
        </div>

        {/* Comments */}
        <div>
          <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            Comments ({actionItem.comments?.length || 0})
          </h4>

          {actionItem.comments && actionItem.comments.length > 0 ? (
            <div className="space-y-3 max-h-60 overflow-y-auto mb-4">
              {actionItem.comments.map((c) => (
                <div key={c.id} className="p-3 bg-muted rounded-md">
                  <p className="text-sm">{c.comment}</p>
                  <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                    <User className="w-3 h-3" />
                    <span>{c.created_by}</span>
                    <span>•</span>
                    <span>{formatDate(new Date(c.created_at), 'PPp')}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground mb-4">No comments yet</p>
          )}

          {/* Add Comment */}
          <div className="flex gap-2">
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Add a comment..."
              rows={2}
              className="flex-1"
            />
            <Button
              onClick={handleAddComment}
              disabled={!comment.trim()}
              size="sm"
              className="self-end"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-between items-center pt-4 border-t">
          <Button
            variant="outline"
            size="sm"
            onClick={() => emailActionItem(actionItem)}
          >
            <Mail className="w-4 h-4 mr-1" />
            Email to {actionItem.assigned_to || 'Assignee'}
          </Button>
          <Button variant="outline" onClick={onClose}>
            <X className="w-4 h-4 mr-1" />
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default ActionItemDetails;
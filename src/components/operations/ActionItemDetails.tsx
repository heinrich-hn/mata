import { Button } from '@/components/ui/button';
import Modal from '@/components/ui/modal';
import { Textarea } from '@/components/ui/textarea';
import { ActionItem } from '@/types/operations';
import { formatDate } from 'date-fns';
import {
    Calendar,
    CheckCircle,
    Clock,
    MessageSquare,
    Send,
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
}

const ActionItemDetails = ({
  isOpen,
  onClose,
  actionItem,
  onStatusChange,
  onAddComment
}: ActionItemDetailsProps) => {
  const [comment, setComment] = useState('');

  // Calculate overdue status
  const today = new Date();
  const dueDate = actionItem.due_date ? new Date(actionItem.due_date) : null;
  const isOverdue = dueDate && today > dueDate && actionItem.status !== 'completed';
  const overdueBy = isOverdue && dueDate ? Math.floor((today.getTime() - dueDate.getTime()) / (86400000)) : 0;

  const handleAddComment = () => {
    if (!comment.trim()) return;
    onAddComment(actionItem, comment.trim());
    setComment('');
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
              <div className="flex items-center gap-2 mt-2">
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
              </div>
            </div>

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

        {/* Comments */}
        <div>
          <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            Comments ({actionItem.comments?.length || 0})
          </h4>

          {actionItem.comments && actionItem.comments.length > 0 ? (
            <div className="space-y-3 max-h-60 overflow-y-auto mb-4">
              {actionItem.comments.map((comment) => (
                <div key={comment.id} className="p-3 bg-muted rounded-md">
                  <p className="text-sm">{comment.comment}</p>
                  <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                    <User className="w-3 h-3" />
                    <span>{comment.created_by}</span>
                    <span>•</span>
                    <span>{formatDate(new Date(comment.created_at), 'PPp')}</span>
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
        <div className="flex justify-end gap-3 pt-4 border-t">
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
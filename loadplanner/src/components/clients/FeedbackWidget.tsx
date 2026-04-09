import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { ClientFeedback } from '@/hooks/useClientFeedback';
import { useSubmitFeedback } from '@/hooks/useClientFeedback';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Frown, Loader2, Smile, Send } from 'lucide-react';
import { useState } from 'react';

interface FeedbackWidgetProps {
  loadId: string;
  clientId: string;
  existingFeedback?: ClientFeedback | null;
  /** Render compact inline style (for use inside table rows) */
  compact?: boolean;
}

export function FeedbackWidget({ loadId, clientId, existingFeedback, compact }: FeedbackWidgetProps) {
  const [selectedRating, setSelectedRating] = useState<'happy' | 'unhappy' | null>(
    existingFeedback?.rating ?? null
  );
  const [showCommentBox, setShowCommentBox] = useState(false);
  const [comment, setComment] = useState(existingFeedback?.comment ?? '');
  const [submitted, setSubmitted] = useState(!!existingFeedback);

  const submitFeedback = useSubmitFeedback();
  const { toast } = useToast();

  const handleRatingClick = (rating: 'happy' | 'unhappy') => {
    if (submitted && existingFeedback?.rating === rating) return;

    setSelectedRating(rating);

    if (rating === 'happy') {
      submitFeedback.mutate(
        { load_id: loadId, client_id: clientId, rating: 'happy', comment: null },
        {
          onSuccess: () => {
            setSubmitted(true);
            setShowCommentBox(false);
          },
          onError: () => {
            toast({ title: 'Failed to submit feedback', description: 'Please try again.', variant: 'destructive' });
          },
        }
      );
    } else {
      setShowCommentBox(true);
    }
  };

  const handleSubmitUnhappy = () => {
    submitFeedback.mutate(
      { load_id: loadId, client_id: clientId, rating: 'unhappy', comment: comment || null },
      {
        onSuccess: () => {
          setSubmitted(true);
          setShowCommentBox(false);
        },
        onError: () => {
          toast({ title: 'Failed to submit feedback', description: 'Please try again.', variant: 'destructive' });
        },
      }
    );
  };

  /* ── Compact submitted state (badge only) ── */
  if (compact && submitted && !showCommentBox) {
    return (
      <div className="flex items-center gap-2">
        {selectedRating === 'happy' ? (
          <Badge
            variant="outline"
            className="gap-1 py-0.5 px-2 text-[11px] text-green-700 bg-green-50 border-green-200 dark:text-green-300 dark:bg-green-900/40 dark:border-green-800"
          >
            <Smile className="h-3 w-3" />
            Satisfied
          </Badge>
        ) : (
          <Badge
            variant="outline"
            className="gap-1 py-0.5 px-2 text-[11px] text-red-700 bg-red-50 border-red-200 dark:text-red-300 dark:bg-red-900/40 dark:border-red-800"
          >
            <Frown className="h-3 w-3" />
            Issue
          </Badge>
        )}
        <button
          className="text-[10px] text-muted-foreground hover:text-foreground underline-offset-2 hover:underline transition-colors"
          onClick={() => { setSubmitted(false); setSelectedRating(null); setShowCommentBox(false); }}
        >
          Edit
        </button>
      </div>
    );
  }

  /* ── Compact input state (two buttons) ── */
  if (compact && !submitted) {
    return (
      <div className="space-y-2 w-40">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-muted-foreground mr-1">Rate:</span>
          <button
            className={cn(
              'inline-flex items-center justify-center h-7 w-7 rounded-full border transition-all duration-200',
              selectedRating === 'happy'
                ? 'bg-green-100 text-green-700 border-green-300 ring-1 ring-green-200 dark:bg-green-900/50 dark:text-green-400 dark:border-green-700'
                : 'border-border text-muted-foreground hover:bg-green-50 hover:text-green-700 hover:border-green-200 dark:hover:bg-green-900/30'
            )}
            onClick={() => handleRatingClick('happy')}
            disabled={submitFeedback.isPending}
            title="Satisfied"
          >
            {submitFeedback.isPending && selectedRating === 'happy' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Smile className="h-3.5 w-3.5" />
            )}
          </button>
          <button
            className={cn(
              'inline-flex items-center justify-center h-7 w-7 rounded-full border transition-all duration-200',
              selectedRating === 'unhappy'
                ? 'bg-red-100 text-red-700 border-red-300 ring-1 ring-red-200 dark:bg-red-900/50 dark:text-red-400 dark:border-red-700'
                : 'border-border text-muted-foreground hover:bg-red-50 hover:text-red-700 hover:border-red-200 dark:hover:bg-red-900/30'
            )}
            onClick={() => handleRatingClick('unhappy')}
            disabled={submitFeedback.isPending}
            title="Needs improvement"
          >
            <Frown className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Compact comment box */}
        {showCommentBox && selectedRating === 'unhappy' && (
          <div className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
            <Textarea
              placeholder="What went wrong?"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="min-h-[56px] text-xs resize-none"
              rows={2}
            />
            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                onClick={handleSubmitUnhappy}
                disabled={submitFeedback.isPending}
                className="gap-1.5 h-7 px-2.5 text-xs"
              >
                {submitFeedback.isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Send className="h-3 w-3" />
                )}
                Send
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setShowCommentBox(false); setSelectedRating(null); }}
                disabled={submitFeedback.isPending}
                className="h-7 px-2 text-xs"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  /* ── Full submitted state ── */
  if (submitted && !showCommentBox) {
    return (
      <div className="flex flex-wrap items-center gap-3 p-3 bg-secondary rounded-lg border">
        <div className="flex items-center gap-2">
          {selectedRating === 'happy' ? (
            <Badge
              variant="default"
              className="gap-1.5 py-1 px-2.5 text-green-700 bg-green-100 border-green-200 dark:text-green-300 dark:bg-green-900/50 dark:border-green-800"
            >
              <Smile className="h-4 w-4" />
              Satisfied
            </Badge>
          ) : (
            <Badge
              variant="default"
              className="gap-1.5 py-1 px-2.5 text-red-700 bg-red-100 border-red-200 dark:text-red-300 dark:bg-red-900/50 dark:border-red-800"
            >
              <Frown className="h-4 w-4" />
              Needs Improvement
            </Badge>
          )}
        </div>

        <Button
          variant="outline"
          size="sm"
          className="h-8 px-3 text-xs font-medium"
          onClick={() => {
            setSubmitted(false);
            setSelectedRating(null);
            setShowCommentBox(false);
          }}
        >
          Change Feedback
        </Button>
      </div>
    );
  }

  /* ── Full input state ── */
  return (
    <div className="space-y-3 p-4 bg-secondary/50 rounded-xl border">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">How was your experience?</h3>
        <span className="text-xs text-muted-foreground">Your feedback helps us improve</span>
      </div>

      <div className="flex items-center gap-3 pt-1">
        <Button
          variant="outline"
          size="lg"
          className={cn(
            'h-10 w-10 p-0 rounded-full transition-all duration-300 shadow-sm',
            selectedRating === 'happy'
              ? 'bg-green-100 text-green-700 border-green-300 ring-2 ring-green-200 dark:bg-green-900/50 dark:text-green-400 dark:border-green-700 dark:ring-green-900'
              : 'hover:bg-green-50 hover:text-green-700 hover:border-green-200 dark:hover:bg-green-900/30 dark:hover:border-green-800'
          )}
          onClick={() => handleRatingClick('happy')}
          disabled={submitFeedback.isPending}
          title="Satisfied with service"
        >
          {submitFeedback.isPending && selectedRating === 'happy' ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Smile className="h-5 w-5" />
          )}
        </Button>

        <Button
          variant="outline"
          size="lg"
          className={cn(
            'h-10 w-10 p-0 rounded-full transition-all duration-300 shadow-sm',
            selectedRating === 'unhappy'
              ? 'bg-red-100 text-red-700 border-red-300 ring-2 ring-red-200 dark:bg-red-900/50 dark:text-red-400 dark:border-red-700 dark:ring-red-900'
              : 'hover:bg-red-50 hover:text-red-700 hover:border-red-200 dark:hover:bg-red-900/30 dark:hover:border-red-800'
          )}
          onClick={() => handleRatingClick('unhappy')}
          disabled={submitFeedback.isPending}
          title="Needs improvement"
        >
          <Frown className="h-5 w-5" />
        </Button>
      </div>

      {/* Comment box for unhappy rating */}
      {showCommentBox && selectedRating === 'unhappy' && (
        <div className="pt-2 space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
          <Textarea
            placeholder="What went wrong? Your detailed feedback helps us improve..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="min-h-[80px] text-sm resize-none border-input focus-visible:ring-ring"
            rows={3}
          />
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={handleSubmitUnhappy}
              disabled={submitFeedback.isPending}
              className="gap-2 h-9 px-4"
            >
              {submitFeedback.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Submit Feedback
                </>
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowCommentBox(false);
                setSelectedRating(null);
              }}
              disabled={submitFeedback.isPending}
              className="h-9 px-4"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

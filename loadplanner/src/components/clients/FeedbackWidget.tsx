import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { ClientFeedback } from '@/hooks/useClientFeedback';
import { useSubmitFeedback } from '@/hooks/useClientFeedback';
import { cn } from '@/lib/utils';
import { Frown, Loader2, Smile, Send } from 'lucide-react';
import { useState } from 'react';

interface FeedbackWidgetProps {
  loadId: string;
  clientId: string;
  existingFeedback?: ClientFeedback | null;
}

export function FeedbackWidget({ loadId, clientId, existingFeedback }: FeedbackWidgetProps) {
  const [selectedRating, setSelectedRating] = useState<'happy' | 'unhappy' | null>(
    existingFeedback?.rating ?? null
  );
  const [showCommentBox, setShowCommentBox] = useState(false);
  const [comment, setComment] = useState(existingFeedback?.comment ?? '');
  const [submitted, setSubmitted] = useState(!!existingFeedback);

  const submitFeedback = useSubmitFeedback();

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
      }
    );
  };

  // Already submitted - show current state
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
            'h-12 w-12 p-0 rounded-full transition-all duration-300 shadow-sm',
            selectedRating === 'happy'
              ? 'bg-green-100 text-green-700 border-green-300 ring-2 ring-green-200 dark:bg-green-900/50 dark:text-green-400 dark:border-green-700 dark:ring-green-900'
              : 'hover:bg-green-50 hover:text-green-700 hover:border-green-200 dark:hover:bg-green-900/30 dark:hover:border-green-800'
          )}
          onClick={() => handleRatingClick('happy')}
          disabled={submitFeedback.isPending}
          title="Satisfied with service"
        >
          {submitFeedback.isPending && selectedRating === 'happy' ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Smile className="h-6 w-6" />
          )}
        </Button>
        
        <Button
          variant="outline"
          size="lg"
          className={cn(
            'h-12 w-12 p-0 rounded-full transition-all duration-300 shadow-sm',
            selectedRating === 'unhappy'
              ? 'bg-red-100 text-red-700 border-red-300 ring-2 ring-red-200 dark:bg-red-900/50 dark:text-red-400 dark:border-red-700 dark:ring-red-900'
              : 'hover:bg-red-50 hover:text-red-700 hover:border-red-200 dark:hover:bg-red-900/30 dark:hover:border-red-800'
          )}
          onClick={() => handleRatingClick('unhappy')}
          disabled={submitFeedback.isPending}
          title="Needs improvement"
        >
          <Frown className="h-6 w-6" />
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

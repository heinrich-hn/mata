import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Check } from 'lucide-react';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';

interface AdditionalRevenueBadgeProps {
    tripId: string;
    amount: number;
    currency?: string;
    reason?: string | null;
    verified?: boolean;
    verifiedBy?: string | null;
    verifiedAt?: string | null;
    onChanged?: () => void;
}

const formatAmount = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-ZA', {
        style: 'currency',
        currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount);
};

const AdditionalRevenueBadge = ({
    tripId,
    amount,
    currency = 'USD',
    reason,
    verified,
    verifiedBy,
    verifiedAt,
    onChanged,
}: AdditionalRevenueBadgeProps) => {
    const { userName } = useAuth();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [isPending, setIsPending] = useState(false);

    const hasAdditional = !!amount && amount > 0;

    const handleToggle = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isPending) return;
        setIsPending(true);
        const next = !verified;
        try {
            const { error } = await supabase
                .from('trips')
                .update({
                    additional_revenue_verified: next,
                    additional_revenue_verified_by: next ? (userName || null) : null,
                    additional_revenue_verified_at: next ? new Date().toISOString() : null,
                })
                .eq('id', tripId);
            if (error) throw error;
            toast({
                title: next ? 'Marked as Real Money' : 'Marked as Funny Money',
                description: hasAdditional
                    ? (next
                        ? `Additional revenue of ${formatAmount(amount, currency)} confirmed as Real Money.`
                        : `Additional revenue of ${formatAmount(amount, currency)} flagged as Funny Money.`)
                    : (next
                        ? 'Trip confirmed as Real Money.'
                        : 'Trip flagged as Funny Money.'),
            });
            queryClient.invalidateQueries({ queryKey: ['trips'] });
            onChanged?.();
        } catch (err) {
            toast({
                title: 'Update failed',
                description: err instanceof Error ? err.message : 'Could not update verification.',
                variant: 'destructive',
            });
        } finally {
            setIsPending(false);
        }
    };

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <button
                    type="button"
                    onClick={handleToggle}
                    disabled={isPending}
                    aria-pressed={!!verified}
                    aria-label={verified ? 'Marked as Real Money — click to undo' : 'Mark as Real Money'}
                    className={`inline-flex items-center gap-1 h-5 pl-0.5 pr-1.5 rounded text-[10px] font-medium leading-none transition-colors disabled:opacity-60 whitespace-nowrap ${verified
                            ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                            : 'bg-muted text-muted-foreground hover:bg-muted/80 border border-border/60'
                        }`}
                >
                    <span
                        className={`inline-flex items-center justify-center h-3.5 w-3.5 rounded-sm border ${verified
                                ? 'bg-white border-white text-emerald-600'
                                : 'bg-background border-border text-transparent'
                            }`}
                    >
                        <Check className="h-2.5 w-2.5" strokeWidth={3} />
                    </span>
                    Real Money
                </button>
            </TooltipTrigger>
            <TooltipContent>
                <p className="font-medium">
                    {hasAdditional
                        ? `Third-party revenue: ${formatAmount(amount, currency)}${reason ? ` — ${reason.replace(/_/g, ' ')}` : ''}`
                        : 'No additional revenue recorded'}
                </p>
                {verified ? (
                    <p className="text-xs text-emerald-200">
                        Marked Real Money{verifiedBy ? ` by ${verifiedBy}` : ''}
                        {verifiedAt ? ` on ${format(new Date(verifiedAt), 'dd MMM yyyy')}` : ''}. Click to undo.
                    </p>
                ) : (
                    <p className="text-xs text-amber-200">Click the tick to mark this trip as Real Money.</p>
                )}
            </TooltipContent>
        </Tooltip>
    );
};

export default AdditionalRevenueBadge;

import { CostForm } from '@/components/costs/CostForm';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { useAuth } from '@/contexts/AuthContext';
import { useOperations } from '@/contexts/OperationsContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import type { CostEntry } from '@/types/operations';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import {
    AlertTriangle,
    CheckCircle,
    Edit,
    FileWarning,
    Flag,
    Plus,
    ShieldCheck,
    Trash2,
} from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import FlagResolutionModal from './FlagResolutionModal';

// ─── Verify Reason Options ───
const VERIFY_REASONS = [
    { value: 'verified', label: 'Verified' },
    { value: 'not_needed', label: 'Not needed' },
    { value: 'small_amount', label: 'Too small amount' },
    { value: 'recurring_fee', label: 'Recurring fee' },
    { value: 'driver_confirmed', label: 'Driver confirmed' },
    { value: 'management_approved', label: 'Management approved' },
] as const;

interface TripExpenseInlineProps {
    tripId: string;
    tripNumber?: string;
    route?: string | null;
    /** If true, show a compact view without the add-cost button (for read-only contexts) */
    readOnly?: boolean;
}

const TripExpenseInline = ({
    tripId,
    tripNumber,
    route: _route,
    readOnly = false,
}: TripExpenseInlineProps) => {
    const { toast } = useToast();
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const { deleteCostEntry } = useOperations();

    // UI state
    const [showAddForm, setShowAddForm] = useState(false);
    const [editingCost, setEditingCost] = useState<CostEntry | null>(null);
    const [showEditDialog, setShowEditDialog] = useState(false);
    const [costToDelete, setCostToDelete] = useState<CostEntry | null>(null);
    const [selectedFlaggedCost, setSelectedFlaggedCost] = useState<CostEntry | null>(null);
    const [showFlagModal, setShowFlagModal] = useState(false);
    const [verifyingCostIds, setVerifyingCostIds] = useState<Set<string>>(new Set());
    const [selectedExpenses, setSelectedExpenses] = useState<Set<string>>(new Set());
    const [isBulkVerifying, setIsBulkVerifying] = useState(false);

    // Fetch cost entries for this specific trip
    const {
        data: costs = [],
        isLoading,
        refetch,
    } = useQuery({
        queryKey: ['trip-expenses-inline', tripId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('cost_entries')
                .select('*, cost_attachments (*)')
                .eq('trip_id', tripId)
                .order('date', { ascending: false });

            if (error) throw error;

            return (data || []).map((cost) => ({
                ...cost,
                attachments: (cost.cost_attachments || []).map((att: Record<string, unknown>) => ({
                    id: att.id,
                    filename: att.filename,
                    file_url: att.file_url,
                    file_type: att.file_type,
                    file_size: att.file_size,
                    uploaded_at: att.created_at,
                    cost_entry_id: att.cost_id,
                })),
            })) as CostEntry[];
        },
        staleTime: 15000,
    });

    // Summary stats
    const stats = useMemo(() => {
        let flagged = 0;
        let unresolved = 0;
        let unverified = 0;
        let missingSlip = 0;
        let total = 0;

        costs.forEach((c) => {
            total += c.amount || 0;
            if (c.is_flagged) flagged++;
            if (c.is_flagged && c.investigation_status !== 'resolved') unresolved++;
            if (!c.is_system_generated && c.investigation_status !== 'resolved') unverified++;
            if (
                !c.is_system_generated &&
                c.investigation_status !== 'resolved' &&
                (!c.attachments || c.attachments.length === 0)
            )
                missingSlip++;
        });

        return { flagged, unresolved, unverified, missingSlip, total, count: costs.length };
    }, [costs]);

    // ─── Handlers ───

    const handleRefresh = useCallback(() => {
        refetch();
        queryClient.invalidateQueries({ queryKey: ['trips'] });
        queryClient.invalidateQueries({ queryKey: ['all-expenses'] });
    }, [refetch, queryClient]);

    const handleDelete = async () => {
        if (!costToDelete) return;
        try {
            await deleteCostEntry(costToDelete.id);
            toast({ title: 'Deleted', description: 'Expense deleted successfully' });
            setCostToDelete(null);
            handleRefresh();
        } catch {
            toast({ title: 'Error', description: 'Failed to delete expense', variant: 'destructive' });
        }
    };

    const tryResolveFlaggedCostAlert = async (tid: string) => {
        try {
            const { count } = await supabase
                .from('cost_entries')
                .select('id', { count: 'exact', head: true })
                .eq('trip_id', tid)
                .eq('is_flagged', true)
                .neq('investigation_status', 'resolved');
            if (count === 0) {
                await supabase
                    .from('alerts')
                    .update({ status: 'resolved', resolved_at: new Date().toISOString(), resolution_note: 'All flagged costs resolved' })
                    .eq('source_type', 'trip')
                    .eq('source_id', tid)
                    .eq('category', 'fuel_anomaly')
                    .eq('status', 'active')
                    .filter('metadata->>issue_type', 'eq', 'flagged_costs');
            }
        } catch (err) {
            console.error('Error resolving flagged cost alert:', err);
        }
    };

    const tryResolveVerificationAlerts = async (tid: string) => {
        try {
            const { count } = await supabase
                .from('cost_entries')
                .select('id', { count: 'exact', head: true })
                .eq('trip_id', tid)
                .neq('investigation_status', 'resolved');
            if (count === 0) {
                await supabase
                    .from('alerts')
                    .update({ status: 'resolved', resolved_at: new Date().toISOString(), resolution_note: 'All expenses verified' })
                    .eq('source_type', 'trip')
                    .eq('source_id', tid)
                    .eq('category', 'fuel_anomaly')
                    .eq('status', 'active')
                    .filter('metadata->>issue_type', 'eq', 'unverified_costs');
            }
        } catch (err) {
            console.error('Error resolving verification alerts:', err);
        }
    };

    const handleVerifyCost = async (expense: CostEntry, reason: string) => {
        const costId = expense.id;
        const now = new Date().toISOString();
        const approver = user?.email || 'admin';
        const reasonLabel = VERIFY_REASONS.find((r) => r.value === reason)?.label || reason;

        setVerifyingCostIds((prev) => new Set(prev).add(costId));
        try {
            const { error } = await supabase
                .from('cost_entries')
                .update({
                    investigation_status: 'resolved',
                    investigation_notes: expense.investigation_notes
                        ? `${expense.investigation_notes}\n\n--- VERIFIED ---\n${reasonLabel} by ${approver} on ${new Date().toLocaleDateString('en-ZA')}`
                        : `${reasonLabel} by ${approver} on ${new Date().toLocaleDateString('en-ZA')}`,
                    resolved_at: now,
                    resolved_by: approver,
                })
                .eq('id', costId);

            if (error) throw error;

            // Optimistically update cache
            queryClient.setQueriesData<CostEntry[]>(
                { queryKey: ['trip-expenses-inline', tripId] },
                (old) =>
                    old?.map((e) =>
                        e.id === costId
                            ? { ...e, investigation_status: 'resolved' as const, resolved_at: now, resolved_by: approver }
                            : e,
                    ),
            );

            tryResolveFlaggedCostAlert(tripId);
            tryResolveVerificationAlerts(tripId);

            // Background refresh
            queryClient.invalidateQueries({ queryKey: ['trip-expenses-inline', tripId] });
            queryClient.invalidateQueries({ queryKey: ['trips'] });
            queryClient.invalidateQueries({ queryKey: ['all-expenses'] });
        } catch (err) {
            console.error('Error verifying cost:', err);
            toast({ title: 'Error', description: 'Failed to verify cost entry.', variant: 'destructive' });
        } finally {
            setVerifyingCostIds((prev) => {
                const next = new Set(prev);
                next.delete(costId);
                return next;
            });
        }
    };

    const handleBulkVerify = async (reason: string) => {
        if (selectedExpenses.size === 0) return;
        setIsBulkVerifying(true);
        const now = new Date().toISOString();
        const approver = user?.email || 'admin';
        const reasonLabel = VERIFY_REASONS.find((r) => r.value === reason)?.label || reason;
        const ids = Array.from(selectedExpenses);

        try {
            for (let i = 0; i < ids.length; i += 40) {
                const batch = ids.slice(i, i + 40);
                const { error } = await supabase
                    .from('cost_entries')
                    .update({
                        investigation_status: 'resolved',
                        investigation_notes: `${reasonLabel} (bulk) by ${approver} on ${new Date().toLocaleDateString('en-ZA')}`,
                        resolved_at: now,
                        resolved_by: approver,
                    })
                    .in('id', batch);
                if (error) throw error;
            }

            toast({
                title: 'Bulk Verification Complete',
                description: `${ids.length} expense(s) verified as "${reasonLabel}".`,
            });

            setSelectedExpenses(new Set());
            tryResolveFlaggedCostAlert(tripId);
            tryResolveVerificationAlerts(tripId);
            handleRefresh();
        } catch (err) {
            console.error('Error bulk verifying expenses:', err);
            toast({ title: 'Error', description: 'Failed to bulk verify expenses.', variant: 'destructive' });
        } finally {
            setIsBulkVerifying(false);
        }
    };

    const toggleExpenseSelection = (expenseId: string) => {
        setSelectedExpenses((prev) => {
            const next = new Set(prev);
            if (next.has(expenseId)) next.delete(expenseId);
            else next.add(expenseId);
            return next;
        });
    };

    const toggleSelectAll = () => {
        const unverified = costs.filter((c) => !c.is_system_generated && c.investigation_status !== 'resolved');
        const allSelected = unverified.length > 0 && unverified.every((e) => selectedExpenses.has(e.id));
        setSelectedExpenses((prev) => {
            const next = new Set(prev);
            if (allSelected) {
                unverified.forEach((e) => next.delete(e.id));
            } else {
                unverified.forEach((e) => next.add(e.id));
            }
            return next;
        });
    };

    // ─── Formatters ───
    const fmtCurrency = (amount: number, currency: string = 'USD') => {
        const symbol = currency === 'USD' ? '$' : 'R';
        return `${symbol}${amount.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    const fmtDate = (dateString: string) => {
        try {
            return format(parseISO(dateString), 'dd MMM yyyy');
        } catch {
            return dateString;
        }
    };

    const getStatusBadge = (expense: CostEntry) => {
        if (expense.is_flagged && expense.investigation_status !== 'resolved') {
            return (
                <Badge variant="destructive" className="gap-0.5 text-[10px]">
                    <AlertTriangle className="w-3 h-3" />
                    Flagged
                </Badge>
            );
        }
        if (expense.investigation_status === 'resolved') {
            return (
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 border-emerald-300/50 gap-0.5 text-[10px]">
                    <CheckCircle className="w-3 h-3" />
                    Verified
                </Badge>
            );
        }
        if (expense.is_system_generated) {
            return (
                <Badge variant="outline" className="bg-blue-500/10 text-blue-700 border-blue-300/50 gap-0.5 text-[10px]">
                    System
                </Badge>
            );
        }
        return (
            <Badge variant="outline" className="bg-amber-500/10 text-amber-700 border-amber-300/50 gap-0.5 text-[10px]">
                <AlertTriangle className="w-3 h-3" />
                Pending
            </Badge>
        );
    };

    // ─── Render ───

    if (isLoading) {
        return (
            <div className="px-4 py-6 text-sm text-muted-foreground text-center">Loading expenses...</div>
        );
    }

    const unverifiedCosts = costs.filter((c) => !c.is_system_generated && c.investigation_status !== 'resolved');
    const selectedInGroup = unverifiedCosts.filter((e) => selectedExpenses.has(e.id));

    return (
        <TooltipProvider>
            <div className="border-t bg-muted/20">
                {/* Summary bar */}
                <div className="flex items-center justify-between px-4 py-2.5 bg-muted/40 border-b">
                    <div className="flex items-center gap-3 text-xs">
                        <span className="font-medium">{stats.count} expense{stats.count !== 1 ? 's' : ''}</span>
                        <span className="text-muted-foreground">{fmtCurrency(stats.total)}</span>
                        {stats.unresolved > 0 && (
                            <span className="flex items-center gap-1 text-amber-700">
                                <AlertTriangle className="h-3 w-3" />
                                {stats.unresolved} flagged
                            </span>
                        )}
                        {stats.unverified > 0 && (
                            <span className="flex items-center gap-1 text-orange-700">
                                <Flag className="h-3 w-3" />
                                {stats.unverified} unverified
                            </span>
                        )}
                        {stats.missingSlip > 0 && (
                            <span className="flex items-center gap-1 text-rose-700">
                                <FileWarning className="h-3 w-3" />
                                {stats.missingSlip} missing slips
                            </span>
                        )}
                        {stats.unverified === 0 && stats.unresolved === 0 && stats.count > 0 && (
                            <span className="flex items-center gap-1 text-emerald-700">
                                <CheckCircle className="h-3 w-3" />
                                All verified
                            </span>
                        )}
                    </div>
                    {!readOnly && (
                        <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs" onClick={() => setShowAddForm(true)}>
                            <Plus className="h-3 w-3" />
                            Add Cost
                        </Button>
                    )}
                </div>

                {/* Bulk verify bar */}
                {selectedInGroup.length > 0 && (
                    <div className="flex items-center gap-3 px-4 py-2 bg-emerald-50 dark:bg-emerald-950/20 border-b">
                        <span className="text-xs font-medium text-emerald-700">{selectedInGroup.length} selected</span>
                        <Select onValueChange={(reason) => handleBulkVerify(reason)} disabled={isBulkVerifying}>
                            <SelectTrigger className="w-[160px] h-7 text-xs">
                                <SelectValue placeholder={isBulkVerifying ? 'Verifying...' : 'Verify selected...'} />
                            </SelectTrigger>
                            <SelectContent>
                                {VERIFY_REASONS.map((r) => (
                                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs text-muted-foreground"
                            onClick={() => setSelectedExpenses(new Set())}
                        >
                            Clear
                        </Button>
                    </div>
                )}

                {/* Costs table */}
                {costs.length === 0 ? (
                    <div className="px-4 py-6 text-center">
                        <p className="text-sm text-muted-foreground">No costs recorded for this trip.</p>
                        {!readOnly && (
                            <Button size="sm" variant="outline" className="mt-2 gap-1.5 text-xs" onClick={() => setShowAddForm(true)}>
                                <Plus className="h-3 w-3" />
                                Add First Cost
                            </Button>
                        )}
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <Table className="min-w-[550px]">
                            <TableHeader>
                                <TableRow className="hover:bg-transparent bg-muted/20">
                                    {!readOnly && (
                                        <TableHead className="w-[36px] px-2">
                                            <Checkbox
                                                checked={unverifiedCosts.length > 0 && unverifiedCosts.every((e) => selectedExpenses.has(e.id))}
                                                onCheckedChange={toggleSelectAll}
                                                aria-label="Select all unverified"
                                            />
                                        </TableHead>
                                    )}
                                    <TableHead className="text-xs font-medium">Category</TableHead>
                                    <TableHead className="text-xs font-medium text-right">Amount</TableHead>
                                    <TableHead className="w-[90px] text-xs font-medium">Date</TableHead>
                                    <TableHead className="w-[90px] text-xs font-medium">Status</TableHead>
                                    {!readOnly && <TableHead className="w-[150px] text-xs font-medium">Verify</TableHead>}
                                    {!readOnly && <TableHead className="w-[90px] text-xs font-medium text-right">Actions</TableHead>}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {costs.map((expense) => {
                                    const isMissingSlip = !expense.is_system_generated && (!expense.attachments || expense.attachments.length === 0);
                                    const hasUnresolvedFlag = expense.is_flagged && expense.investigation_status !== 'resolved';
                                    const isVerified = expense.investigation_status === 'resolved';
                                    const isVerifying = verifyingCostIds.has(expense.id);

                                    return (
                                        <TableRow
                                            key={expense.id}
                                            className={
                                                hasUnresolvedFlag
                                                    ? 'bg-amber-50/50 dark:bg-amber-950/20'
                                                    : isMissingSlip && !isVerified
                                                        ? 'bg-rose-50/30 dark:bg-rose-950/10'
                                                        : ''
                                            }
                                        >
                                            {!readOnly && (
                                                <TableCell className="py-2 px-2 w-[36px]">
                                                    {!isVerified && !expense.is_system_generated && (
                                                        <Checkbox
                                                            checked={selectedExpenses.has(expense.id)}
                                                            onCheckedChange={() => toggleExpenseSelection(expense.id)}
                                                        />
                                                    )}
                                                </TableCell>
                                            )}
                                            <TableCell className="py-2">
                                                <div className="flex flex-col gap-0.5">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-sm">{expense.category}</span>
                                                        {isMissingSlip && !isVerified && (
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <FileWarning className="h-3.5 w-3.5 text-rose-500" />
                                                                </TooltipTrigger>
                                                                <TooltipContent><p>Missing slip/attachment</p></TooltipContent>
                                                            </Tooltip>
                                                        )}
                                                    </div>
                                                    {expense.sub_category && (
                                                        <span className="text-xs text-muted-foreground">{expense.sub_category}</span>
                                                    )}
                                                    {expense.reference_number && (
                                                        <span className="text-[10px] text-muted-foreground/70">Ref: {expense.reference_number}</span>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className="py-2 text-right font-medium tabular-nums text-sm">
                                                {fmtCurrency(expense.amount, expense.currency || 'USD')}
                                            </TableCell>
                                            <TableCell className="py-2 text-xs text-muted-foreground">
                                                {fmtDate(expense.date)}
                                            </TableCell>
                                            <TableCell className="py-2">
                                                {isMissingSlip && !isVerified ? (
                                                    <Badge variant="outline" className="bg-rose-100 text-rose-700 border-rose-300 gap-0.5 text-[10px]">
                                                        <FileWarning className="w-3 h-3" />
                                                        No Slip
                                                    </Badge>
                                                ) : (
                                                    getStatusBadge(expense)
                                                )}
                                            </TableCell>
                                            {!readOnly && (
                                                <TableCell className="py-2">
                                                    {isVerified ? (
                                                        <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                                                            <ShieldCheck className="w-3 h-3" /> Done
                                                        </span>
                                                    ) : expense.is_system_generated ? (
                                                        <span className="text-xs text-blue-600 font-medium">Auto</span>
                                                    ) : isVerifying ? (
                                                        <span className="text-xs text-muted-foreground">Verifying...</span>
                                                    ) : (
                                                        <Select
                                                            onValueChange={(reason) => handleVerifyCost(expense, reason)}
                                                            disabled={isVerifying}
                                                        >
                                                            <SelectTrigger className="h-7 w-[130px] text-xs">
                                                                <SelectValue placeholder="Verify as..." />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {VERIFY_REASONS.map((r) => (
                                                                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    )}
                                                </TableCell>
                                            )}
                                            {!readOnly && (
                                                <TableCell className="py-2 text-right">
                                                    <div className="flex items-center justify-end gap-0.5">
                                                        {hasUnresolvedFlag && (
                                                            <Button
                                                                size="icon"
                                                                variant="ghost"
                                                                className="h-7 w-7 text-amber-600"
                                                                onClick={() => {
                                                                    setSelectedFlaggedCost(expense);
                                                                    setShowFlagModal(true);
                                                                }}
                                                                title="Resolve Flag"
                                                            >
                                                                <Flag className="w-3.5 h-3.5" />
                                                            </Button>
                                                        )}
                                                        <Button
                                                            size="icon"
                                                            variant="ghost"
                                                            className="h-7 w-7"
                                                            onClick={() => {
                                                                setEditingCost(expense);
                                                                setShowEditDialog(true);
                                                            }}
                                                            title="Edit"
                                                        >
                                                            <Edit className="w-3.5 h-3.5" />
                                                        </Button>
                                                        <Button
                                                            size="icon"
                                                            variant="ghost"
                                                            className="h-7 w-7 text-destructive hover:text-destructive"
                                                            onClick={() => setCostToDelete(expense)}
                                                            title="Delete"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            )}
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>
                )}

                {/* Add Cost Form (shown inline when triggered) */}
                {showAddForm && (
                    <div className="border-t p-4">
                        <CostForm
                            tripId={tripId}
                            onSubmit={(success) => {
                                if (success) {
                                    setShowAddForm(false);
                                    handleRefresh();
                                }
                            }}
                            onCancel={() => setShowAddForm(false)}
                        />
                    </div>
                )}

                {/* Edit Dialog */}
                <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
                    <DialogContent className="max-w-2xl">
                        <DialogHeader>
                            <DialogTitle>Edit Expense{tripNumber ? ` — POD #${tripNumber}` : ''}</DialogTitle>
                        </DialogHeader>
                        {editingCost && (
                            <CostForm
                                tripId={editingCost.trip_id || tripId}
                                cost={editingCost as import('@/types/forms').Cost}
                                onSubmit={(success) => {
                                    if (success) {
                                        setShowEditDialog(false);
                                        setEditingCost(null);
                                        handleRefresh();
                                    }
                                }}
                                onCancel={() => {
                                    setShowEditDialog(false);
                                    setEditingCost(null);
                                }}
                            />
                        )}
                    </DialogContent>
                </Dialog>

                {/* Flag Resolution Modal */}
                <FlagResolutionModal
                    cost={selectedFlaggedCost}
                    isOpen={showFlagModal}
                    onClose={() => {
                        setShowFlagModal(false);
                        setSelectedFlaggedCost(null);
                    }}
                    onResolve={() => {
                        const costId = selectedFlaggedCost?.id;
                        if (costId) {
                            queryClient.setQueriesData<CostEntry[]>(
                                { queryKey: ['trip-expenses-inline', tripId] },
                                (old) =>
                                    old?.map((e) =>
                                        e.id === costId
                                            ? { ...e, investigation_status: 'resolved' as const, resolved_at: new Date().toISOString() }
                                            : e,
                                    ),
                            );
                        }
                        queryClient.invalidateQueries({ queryKey: ['trip-expenses-inline', tripId] });
                        queryClient.invalidateQueries({ queryKey: ['trips'] });
                        queryClient.invalidateQueries({ queryKey: ['all-expenses'] });
                        setShowFlagModal(false);
                        setSelectedFlaggedCost(null);
                        tryResolveFlaggedCostAlert(tripId);
                    }}
                />

                {/* Delete Confirmation */}
                <AlertDialog open={!!costToDelete} onOpenChange={() => setCostToDelete(null)}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Delete Expense</AlertDialogTitle>
                            <AlertDialogDescription>
                                Are you sure you want to delete this expense? This action cannot be undone.
                                {costToDelete?.is_flagged && (
                                    <span className="block mt-2 text-amber-600 font-medium">
                                        Warning: This expense is flagged and may require investigation.
                                    </span>
                                )}
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
                                Delete
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </TooltipProvider>
    );
};

export default TripExpenseInline;

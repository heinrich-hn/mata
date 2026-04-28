import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import {
    formatTotalCost,
    type RouteExpenseConfig,
    type RouteExpenseItem,
    useAddRouteExpenseConfig,
    useDeleteRouteExpenseConfig,
    useRoutePredefinedExpenses,
    useRouteRateHistory,
    useUpdateRouteExpenseConfig,
} from '@/hooks/useRoutePredefinedExpenses';
import { useCostCategories } from '@/hooks/useCostCategories';
import {
    ChevronDown,
    ChevronRight,
    Edit2,
    History,
    Loader2,
    Plus,
    Route as RouteIcon,
    Trash2,
} from 'lucide-react';
import { Fragment, useEffect, useMemo, useState } from 'react';

const emptyExpenseItem: Omit<RouteExpenseItem, 'id' | 'route_config_id'> = {
    category: '',
    sub_category: '',
    amount: 0,
    currency: 'USD',
    is_required: true,
    description: '',
};

interface RouteFormState {
    route: string;
    description: string;
    rate_type: 'per_load' | 'per_km';
    rate_amount: number;
    rate_currency: string;
    rate_change_notes: string;
    expenses: Omit<RouteExpenseItem, 'id' | 'route_config_id'>[];
}

const EMPTY_FORM: RouteFormState = {
    route: '',
    description: '',
    rate_type: 'per_load',
    rate_amount: 0,
    rate_currency: 'USD',
    rate_change_notes: '',
    expenses: [],
};

const formatCurrency = (amount: number, currency: string) => {
    const symbol = currency === 'USD' ? '$' : 'R';
    return `${symbol}${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const PredefinedRoutesSection = () => {
    const { toast } = useToast();
    const { data: configs = [], isLoading } = useRoutePredefinedExpenses();
    const addMutation = useAddRouteExpenseConfig();
    const updateMutation = useUpdateRouteExpenseConfig();
    const deleteMutation = useDeleteRouteExpenseConfig();

    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [search, setSearch] = useState('');

    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingConfig, setEditingConfig] = useState<RouteExpenseConfig | null>(null);
    const [form, setForm] = useState<RouteFormState>(EMPTY_FORM);

    const [deleteTarget, setDeleteTarget] = useState<RouteExpenseConfig | null>(null);
    const [historyTarget, setHistoryTarget] = useState<RouteExpenseConfig | null>(null);

    const { data: dynamicCategories = [] } = useCostCategories();
    const mainCategories = useMemo(
        () => dynamicCategories.map(c => c.name),
        [dynamicCategories],
    );
    const getSubCategories = (name: string): string[] => {
        const dyn = dynamicCategories.find(c => c.name === name);
        return dyn ? dyn.subcategories.map(s => s.name) : [];
    };

    // Reset form when dialog closes
    useEffect(() => {
        if (!isFormOpen) {
            setForm(EMPTY_FORM);
            setEditingConfig(null);
        }
    }, [isFormOpen]);

    // Populate form when editing
    useEffect(() => {
        if (editingConfig) {
            setForm({
                route: editingConfig.route,
                description: editingConfig.description || '',
                rate_type: editingConfig.rate_type || 'per_load',
                rate_amount: editingConfig.rate_amount || 0,
                rate_currency: editingConfig.rate_currency || 'USD',
                rate_change_notes: '',
                expenses: editingConfig.expenses.map(e => ({
                    category: e.category,
                    sub_category: e.sub_category,
                    amount: e.amount,
                    currency: e.currency,
                    is_required: e.is_required,
                    description: e.description || '',
                })),
            });
        }
    }, [editingConfig]);

    const filteredConfigs = useMemo(() => {
        if (!search.trim()) return configs;
        const q = search.toLowerCase();
        return configs.filter(c =>
            c.route.toLowerCase().includes(q) ||
            c.description?.toLowerCase().includes(q)
        );
    }, [configs, search]);

    const isDefaultConfig = (config: RouteExpenseConfig) => config.id.startsWith('default-');

    const handleOpenAdd = () => {
        setEditingConfig(null);
        setForm({ ...EMPTY_FORM, expenses: [{ ...emptyExpenseItem }] });
        setIsFormOpen(true);
    };

    const handleOpenEdit = (config: RouteExpenseConfig) => {
        setEditingConfig(config);
        setIsFormOpen(true);
    };

    const handleAddExpenseItem = () => {
        setForm(f => ({ ...f, expenses: [...f.expenses, { ...emptyExpenseItem }] }));
    };

    const handleRemoveExpenseItem = (idx: number) => {
        setForm(f => ({ ...f, expenses: f.expenses.filter((_, i) => i !== idx) }));
    };

    const handleUpdateExpenseItem = (
        idx: number,
        field: keyof Omit<RouteExpenseItem, 'id' | 'route_config_id'>,
        value: string | number | boolean,
    ) => {
        setForm(f => {
            const updated = [...f.expenses];
            updated[idx] = { ...updated[idx], [field]: value };
            // Reset sub_category when category changes
            if (field === 'category') {
                updated[idx].sub_category = '';
            }
            return { ...f, expenses: updated };
        });
    };

    const handleSubmit = async () => {
        const trimmedRoute = form.route.trim();
        if (!trimmedRoute) {
            toast({
                title: 'Validation error',
                description: 'Route name is required',
                variant: 'destructive',
            });
            return;
        }

        const validExpenses = form.expenses.filter(
            e => e.category && e.sub_category && e.amount >= 0,
        );

        try {
            if (editingConfig && !isDefaultConfig(editingConfig)) {
                await updateMutation.mutateAsync({
                    id: editingConfig.id,
                    description: form.description.trim() || undefined,
                    rate_type: form.rate_type,
                    rate_amount: form.rate_amount,
                    rate_currency: form.rate_currency,
                    rate_change_notes: form.rate_change_notes.trim() || undefined,
                    expenses: validExpenses,
                });
            } else {
                // Either creating new, or "editing" a default fallback (which means seeding the table)
                await addMutation.mutateAsync({
                    route: trimmedRoute.toUpperCase(),
                    description: form.description.trim() || undefined,
                    rate_type: form.rate_type,
                    rate_amount: form.rate_amount,
                    rate_currency: form.rate_currency,
                    expenses: validExpenses,
                });
            }
            setIsFormOpen(false);
        } catch {
            // Toast handled by mutation hooks
        }
    };

    const handleConfirmDelete = async () => {
        if (!deleteTarget) return;
        if (isDefaultConfig(deleteTarget)) {
            toast({
                title: 'Cannot delete',
                description: 'Default routes are read-only. Save a custom version first to override it.',
                variant: 'destructive',
            });
            setDeleteTarget(null);
            return;
        }
        try {
            await deleteMutation.mutateAsync(deleteTarget.id);
        } finally {
            setDeleteTarget(null);
        }
    };

    return (
        <div className="space-y-4">
            <Card>
                <CardHeader className="pb-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <CardTitle className="text-base flex items-center gap-2">
                                <RouteIcon className="h-4 w-4" />
                                Predefined Routes
                            </CardTitle>
                            <p className="text-sm text-muted-foreground mt-1">
                                Manage routes and their pre-configured expenses. These are referenced when adding or editing trips.
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <Input
                                placeholder="Search routes..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="h-9 w-[220px]"
                            />
                            <Button size="sm" onClick={handleOpenAdd} className="gap-1.5">
                                <Plus className="h-4 w-4" />
                                Add Route
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    {isLoading ? (
                        <div className="flex items-center gap-2 px-4 py-8 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Loading routes...
                        </div>
                    ) : filteredConfigs.length === 0 ? (
                        <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                            {search ? 'No routes match your search.' : 'No predefined routes yet. Add one to get started.'}
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-8"></TableHead>
                                    <TableHead>Route</TableHead>
                                    <TableHead>Description</TableHead>
                                    <TableHead>Rate</TableHead>
                                    <TableHead className="text-center"># Expenses</TableHead>
                                    <TableHead className="text-right">Total Cost</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredConfigs.map(config => {
                                    const isExpanded = expandedId === config.id;
                                    const isDefault = isDefaultConfig(config);
                                    return (
                                        <Fragment key={config.id}>
                                            <TableRow className="group">
                                                <TableCell className="w-8 pr-0">
                                                    {config.expenses.length > 0 ? (
                                                        <button
                                                            onClick={() => setExpandedId(isExpanded ? null : config.id)}
                                                            className="p-1 hover:bg-muted rounded"
                                                            aria-label={isExpanded ? 'Collapse' : 'Expand'}
                                                        >
                                                            {isExpanded ? (
                                                                <ChevronDown className="h-3.5 w-3.5" />
                                                            ) : (
                                                                <ChevronRight className="h-3.5 w-3.5" />
                                                            )}
                                                        </button>
                                                    ) : null}
                                                </TableCell>
                                                <TableCell className="font-medium">
                                                    <span className="flex items-center gap-2">
                                                        {config.route}
                                                        {isDefault && (
                                                            <Badge variant="outline" className="text-[10px] uppercase">
                                                                Default
                                                            </Badge>
                                                        )}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="text-sm text-muted-foreground max-w-[300px] truncate">
                                                    {config.description || '—'}
                                                </TableCell>
                                                <TableCell className="text-sm font-mono whitespace-nowrap">
                                                    {config.rate_amount > 0 ? (
                                                        <span>
                                                            {formatCurrency(config.rate_amount, config.rate_currency)}
                                                            <span className="text-muted-foreground ml-1">
                                                                / {config.rate_type === 'per_km' ? 'km' : 'load'}
                                                            </span>
                                                        </span>
                                                    ) : (
                                                        <span className="text-muted-foreground">—</span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-center text-sm">
                                                    {config.expenses.length}
                                                </TableCell>
                                                <TableCell className="text-right font-mono text-sm">
                                                    {formatTotalCost(config.expenses)}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex items-center justify-end gap-1">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => setHistoryTarget(config)}
                                                            disabled={isDefault}
                                                            className="h-8 px-2"
                                                            title="View rate history"
                                                        >
                                                            <History className="h-3.5 w-3.5" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => handleOpenEdit(config)}
                                                            className="h-8 px-2"
                                                        >
                                                            <Edit2 className="h-3.5 w-3.5 mr-1" />
                                                            Edit
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => setDeleteTarget(config)}
                                                            disabled={isDefault}
                                                            className="h-8 px-2 text-destructive hover:text-destructive"
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                            {isExpanded && config.expenses.length > 0 && (
                                                <TableRow className="bg-muted/30 hover:bg-muted/30">
                                                    <TableCell colSpan={7} className="p-0">
                                                        <div className="px-6 py-3">
                                                            <div className="text-xs font-medium text-muted-foreground mb-2">
                                                                Pre-configured expenses
                                                            </div>
                                                            <Table>
                                                                <TableHeader>
                                                                    <TableRow>
                                                                        <TableHead className="h-8 text-xs">Category</TableHead>
                                                                        <TableHead className="h-8 text-xs">Sub-category</TableHead>
                                                                        <TableHead className="h-8 text-xs">Description</TableHead>
                                                                        <TableHead className="h-8 text-xs text-right">Amount</TableHead>
                                                                        <TableHead className="h-8 text-xs text-center">Required</TableHead>
                                                                    </TableRow>
                                                                </TableHeader>
                                                                <TableBody>
                                                                    {config.expenses.map(expense => (
                                                                        <TableRow key={expense.id} className="bg-background">
                                                                            <TableCell className="text-sm">{expense.category}</TableCell>
                                                                            <TableCell className="text-sm">{expense.sub_category}</TableCell>
                                                                            <TableCell className="text-sm text-muted-foreground">
                                                                                {expense.description || '—'}
                                                                            </TableCell>
                                                                            <TableCell className="text-sm text-right font-mono">
                                                                                {formatCurrency(expense.amount, expense.currency)}
                                                                            </TableCell>
                                                                            <TableCell className="text-center">
                                                                                {expense.is_required ? (
                                                                                    <Badge variant="default" className="text-[10px]">Required</Badge>
                                                                                ) : (
                                                                                    <Badge variant="outline" className="text-[10px]">Optional</Badge>
                                                                                )}
                                                                            </TableCell>
                                                                        </TableRow>
                                                                    ))}
                                                                </TableBody>
                                                            </Table>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </Fragment>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* Add / Edit Dialog */}
            <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>
                            {editingConfig ? `Edit Route: ${editingConfig.route}` : 'Add Predefined Route'}
                        </DialogTitle>
                        <DialogDescription>
                            Configure the route and the expenses that will be suggested when this route is selected on a trip.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="route-name">
                                    Route Name <span className="text-destructive">*</span>
                                </Label>
                                <Input
                                    id="route-name"
                                    value={form.route}
                                    onChange={e => setForm(f => ({ ...f, route: e.target.value }))}
                                    placeholder="e.g. JHB → HARARE"
                                    disabled={!!editingConfig && !isDefaultConfig(editingConfig)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="route-description">Description</Label>
                                <Input
                                    id="route-description"
                                    value={form.description}
                                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                                    placeholder="Optional notes"
                                />
                            </div>
                        </div>

                        <div className="rounded-md border p-3 space-y-3 bg-muted/20">
                            <div className="flex items-center justify-between">
                                <div>
                                    <Label className="text-sm font-medium">Default Trip Rate</Label>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                        Auto-fills the revenue rate when this route is selected on a new trip.
                                    </p>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div className="space-y-1.5">
                                    <Label className="text-xs">Rate Type</Label>
                                    <Select
                                        value={form.rate_type}
                                        onValueChange={v =>
                                            setForm(f => ({ ...f, rate_type: v as 'per_load' | 'per_km' }))
                                        }
                                    >
                                        <SelectTrigger className="h-9">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="per_load">Per Load (flat fee)</SelectItem>
                                            <SelectItem value="per_km">Per Kilometre</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs">
                                        Amount {form.rate_type === 'per_km' ? '(per km)' : '(per load)'}
                                    </Label>
                                    <Input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={form.rate_amount}
                                        onChange={e =>
                                            setForm(f => ({
                                                ...f,
                                                rate_amount: parseFloat(e.target.value) || 0,
                                            }))
                                        }
                                        className="h-9"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs">Currency</Label>
                                    <Select
                                        value={form.rate_currency}
                                        onValueChange={v => setForm(f => ({ ...f, rate_currency: v }))}
                                    >
                                        <SelectTrigger className="h-9">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="USD">USD ($)</SelectItem>
                                            <SelectItem value="ZAR">ZAR (R)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            {editingConfig && !isDefaultConfig(editingConfig) && (
                                <div className="space-y-1.5">
                                    <Label className="text-xs">
                                        Reason for rate change (optional)
                                    </Label>
                                    <Textarea
                                        value={form.rate_change_notes}
                                        onChange={e =>
                                            setForm(f => ({ ...f, rate_change_notes: e.target.value }))
                                        }
                                        rows={2}
                                        placeholder="e.g. New customer agreement effective today. Existing trips keep prior rate."
                                    />
                                    <p className="text-[11px] text-muted-foreground">
                                        New trips created after saving will use the new rate. Existing trips are not changed.
                                    </p>
                                </div>
                            )}
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label>Pre-configured Expenses</Label>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={handleAddExpenseItem}
                                    className="gap-1.5"
                                >
                                    <Plus className="h-3.5 w-3.5" />
                                    Add Expense
                                </Button>
                            </div>

                            {form.expenses.length === 0 ? (
                                <div className="rounded-md border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
                                    No expenses yet. Click "Add Expense" to add the first one.
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {form.expenses.map((expense, idx) => {
                                        const subCategories = expense.category
                                            ? getSubCategories(expense.category)
                                            : [];
                                        return (
                                            <div
                                                key={idx}
                                                className="rounded-md border p-3 space-y-3 bg-muted/30"
                                            >
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs font-medium text-muted-foreground">
                                                        Expense #{idx + 1}
                                                    </span>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleRemoveExpenseItem(idx)}
                                                        className="h-7 px-2 text-destructive hover:text-destructive"
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </Button>
                                                </div>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                    <div className="space-y-1.5">
                                                        <Label className="text-xs">Category</Label>
                                                        <Select
                                                            value={expense.category}
                                                            onValueChange={v => handleUpdateExpenseItem(idx, 'category', v)}
                                                        >
                                                            <SelectTrigger className="h-9">
                                                                <SelectValue placeholder="Select category" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {mainCategories.map(c => (
                                                                    <SelectItem key={c} value={c}>{c}</SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <Label className="text-xs">Sub-category</Label>
                                                        <Select
                                                            value={expense.sub_category}
                                                            onValueChange={v => handleUpdateExpenseItem(idx, 'sub_category', v)}
                                                            disabled={!expense.category}
                                                        >
                                                            <SelectTrigger className="h-9">
                                                                <SelectValue placeholder="Select sub-category" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {subCategories.map(s => (
                                                                    <SelectItem key={s} value={s}>{s}</SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <Label className="text-xs">Amount</Label>
                                                        <Input
                                                            type="number"
                                                            step="0.01"
                                                            min="0"
                                                            value={expense.amount}
                                                            onChange={e =>
                                                                handleUpdateExpenseItem(
                                                                    idx,
                                                                    'amount',
                                                                    parseFloat(e.target.value) || 0,
                                                                )
                                                            }
                                                            className="h-9"
                                                        />
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <Label className="text-xs">Currency</Label>
                                                        <Select
                                                            value={expense.currency}
                                                            onValueChange={v => handleUpdateExpenseItem(idx, 'currency', v)}
                                                        >
                                                            <SelectTrigger className="h-9">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="USD">USD ($)</SelectItem>
                                                                <SelectItem value="ZAR">ZAR (R)</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                </div>
                                                <div className="space-y-1.5">
                                                    <Label className="text-xs">Description (optional)</Label>
                                                    <Textarea
                                                        value={expense.description || ''}
                                                        onChange={e =>
                                                            handleUpdateExpenseItem(idx, 'description', e.target.value)
                                                        }
                                                        rows={1}
                                                        placeholder="Optional notes about this expense"
                                                    />
                                                </div>
                                                <div className="flex items-center justify-between pt-1">
                                                    <Label
                                                        htmlFor={`required-${idx}`}
                                                        className="text-xs cursor-pointer"
                                                    >
                                                        Auto-add to trip when route is selected
                                                    </Label>
                                                    <Switch
                                                        id={`required-${idx}`}
                                                        checked={expense.is_required}
                                                        onCheckedChange={v =>
                                                            handleUpdateExpenseItem(idx, 'is_required', v)
                                                        }
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsFormOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSubmit}
                            disabled={addMutation.isPending || updateMutation.isPending}
                        >
                            {(addMutation.isPending || updateMutation.isPending) ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Saving...
                                </>
                            ) : editingConfig ? (
                                'Update Route'
                            ) : (
                                'Add Route'
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete confirmation */}
            <AlertDialog open={!!deleteTarget} onOpenChange={v => !v && setDeleteTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete predefined route?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will remove <strong>{deleteTarget?.route}</strong> and its{' '}
                            {deleteTarget?.expenses.length || 0} pre-configured expense(s). Existing trips
                            using this route will not be affected. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleConfirmDelete}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {deleteMutation.isPending ? 'Deleting...' : 'Delete Route'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Rate history dialog */}
            <RouteRateHistoryDialog
                config={historyTarget}
                onClose={() => setHistoryTarget(null)}
            />
        </div>
    );
};

interface RouteRateHistoryDialogProps {
    config: RouteExpenseConfig | null;
    onClose: () => void;
}

const RouteRateHistoryDialog = ({ config, onClose }: RouteRateHistoryDialogProps) => {
    const { data: history = [], isLoading } = useRouteRateHistory(config?.id ?? null);

    return (
        <Dialog open={!!config} onOpenChange={v => !v && onClose()}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Rate History {config ? `— ${config.route}` : ''}</DialogTitle>
                    <DialogDescription>
                        Historical record of rate changes. New trips use the rate that was current at the time they were created.
                    </DialogDescription>
                </DialogHeader>
                <div className="max-h-[60vh] overflow-y-auto">
                    {isLoading ? (
                        <div className="flex items-center gap-2 px-2 py-6 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Loading history...
                        </div>
                    ) : history.length === 0 ? (
                        <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                            No rate changes recorded yet.
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="text-xs">When</TableHead>
                                    <TableHead className="text-xs">Changed by</TableHead>
                                    <TableHead className="text-xs">Previous</TableHead>
                                    <TableHead className="text-xs">New</TableHead>
                                    <TableHead className="text-xs">Notes</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {history.map(entry => (
                                    <TableRow key={entry.id}>
                                        <TableCell className="text-xs whitespace-nowrap">
                                            {new Date(entry.changed_at).toLocaleString()}
                                        </TableCell>
                                        <TableCell className="text-xs">
                                            {entry.changed_by || '—'}
                                        </TableCell>
                                        <TableCell className="text-xs font-mono">
                                            {entry.previous_rate_amount !== null && entry.previous_rate_type ? (
                                                <>
                                                    {formatCurrency(
                                                        entry.previous_rate_amount,
                                                        entry.previous_rate_currency || 'USD',
                                                    )}
                                                    <span className="text-muted-foreground">
                                                        {' '}/ {entry.previous_rate_type === 'per_km' ? 'km' : 'load'}
                                                    </span>
                                                </>
                                            ) : (
                                                <span className="text-muted-foreground">—</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-xs font-mono">
                                            {formatCurrency(entry.rate_amount, entry.rate_currency)}
                                            <span className="text-muted-foreground">
                                                {' '}/ {entry.rate_type === 'per_km' ? 'km' : 'load'}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-xs text-muted-foreground max-w-[260px]">
                                            {entry.notes || '—'}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Close</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default PredefinedRoutesSection;

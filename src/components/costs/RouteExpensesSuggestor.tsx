import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  formatExpenseAmount,
  getExpenseBadgeColor,
  RouteExpense
} from '@/constants/routePredefinedExpenses';
import { useToast } from '@/hooks/use-toast';
import { requestGoogleSheetsSync } from '@/hooks/useGoogleSheetsSync';
import { useRouteExpenses } from '@/hooks/useRouteExpenses';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  DollarSign,
  Loader2,
  MapPin,
  Plus,
  Sparkles,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

interface RouteExpensesSuggestorProps {
  tripId: string;
  route: string | null | undefined;
  existingCosts: Array<{ category: string; sub_category?: string }>;
  onExpensesAdded: () => void;
}

const RouteExpensesSuggestor = ({
  tripId,
  route,
  existingCosts,
  onExpensesAdded,
}: RouteExpensesSuggestorProps) => {
  const { toast } = useToast();
  const { data: routeConfig, isLoading } = useRouteExpenses(route);
  const [selectedExpenses, setSelectedExpenses] = useState<Set<number>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOpen, setIsOpen] = useState(true);
  const [hasAutoSelectedRequired, setHasAutoSelectedRequired] = useState(false);

  // Check which expenses already exist
  const expenseStatus = useMemo(() => {
    if (!routeConfig?.expenses) return new Map<number, boolean>();

    const statusMap = new Map<number, boolean>();
    routeConfig.expenses.forEach((expense, index) => {
      const exists = existingCosts.some(
        (cost) =>
          cost.category === expense.category &&
          cost.sub_category === expense.sub_category
      );
      statusMap.set(index, exists);
    });
    return statusMap;
  }, [routeConfig?.expenses, existingCosts]);

  // Filter out already added expenses and calculate missing ones
  const missingExpenses = useMemo(() => {
    if (!routeConfig?.expenses) return [];
    return routeConfig.expenses.filter((_, index) => !expenseStatus.get(index));
  }, [routeConfig?.expenses, expenseStatus]);

  // Auto-select required expenses when route config loads
  useEffect(() => {
    if (!routeConfig?.expenses || hasAutoSelectedRequired) return;

    const requiredIndices = routeConfig.expenses
      .map((expense, index) => ({ expense, index }))
      .filter(({ expense, index }) => expense.is_required && !expenseStatus.get(index))
      .map(({ index }) => index);

    if (requiredIndices.length > 0) {
      setSelectedExpenses(new Set(requiredIndices));
      setHasAutoSelectedRequired(true);
    }
  }, [routeConfig?.expenses, expenseStatus, hasAutoSelectedRequired]);

  // Calculate totals
  const totals = useMemo(() => {
    if (!routeConfig?.expenses) return { required: 0, selected: 0 };

    let required = 0;
    let selected = 0;

    routeConfig.expenses.forEach((expense, index) => {
      if (expenseStatus.get(index)) return; // Skip already added

      if (expense.is_required) {
        required += expense.amount;
      }

      if (selectedExpenses.has(index)) {
        selected += expense.amount;
      }
    });

    return { required, selected };
  }, [routeConfig?.expenses, expenseStatus, selectedExpenses]);

  const handleToggleExpense = useCallback((index: number) => {
    setSelectedExpenses((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    if (!routeConfig?.expenses) return;
    const allMissingIndices = routeConfig.expenses
      .map((_, index) => index)
      .filter((index) => !expenseStatus.get(index));
    setSelectedExpenses(new Set(allMissingIndices));
  }, [routeConfig?.expenses, expenseStatus]);

  const handleSelectRequired = useCallback(() => {
    if (!routeConfig?.expenses) return;
    const requiredIndices = routeConfig.expenses
      .map((expense, index) => ({ expense, index }))
      .filter(({ expense, index }) => expense.is_required && !expenseStatus.get(index))
      .map(({ index }) => index);
    setSelectedExpenses(new Set(requiredIndices));
  }, [routeConfig?.expenses, expenseStatus]);

  const handleClearSelection = useCallback(() => {
    setSelectedExpenses(new Set());
  }, []);

  const handleAddSelectedExpenses = useCallback(async () => {
    if (!routeConfig?.expenses || selectedExpenses.size === 0) return;

    setIsSubmitting(true);
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      const expensesToAdd = routeConfig.expenses
        .filter((_, index) => selectedExpenses.has(index))
        .map((expense) => ({
          trip_id: tripId,
          category: expense.category,
          sub_category: expense.sub_category,
          amount: expense.amount,
          currency: expense.currency,
          date: today,
          notes: `Auto-added from route: ${route}`,
          is_flagged: false,
          is_system_generated: true,
        }));

      const { error } = await supabase.from('cost_entries').insert(expensesToAdd);

      if (error) throw error;

      // Auto-resolve any active "no costs" alert for this trip
      if (tripId) {
        supabase
          .from('alerts')
          .update({
            status: 'resolved',
            resolved_at: new Date().toISOString(),
            resolution_note: 'Route expenses added',
          })
          .eq('source_type', 'trip')
          .eq('source_id', tripId)
          .eq('category', 'fuel_anomaly')
          .eq('status', 'active')
          .filter('metadata->>issue_type', 'eq', 'no_costs')
          .then(({ error: resolveErr }) => {
            if (resolveErr) console.error('Error auto-resolving no_costs alert:', resolveErr);
          });
      }

      toast({
        title: 'Expenses Added',
        description: `${expensesToAdd.length} expense(s) have been added to this trip`,
      });
      requestGoogleSheetsSync('trips');

      setSelectedExpenses(new Set());
      onExpensesAdded();
    } catch (error) {
      console.error('Error adding expenses:', error);
      toast({
        title: 'Error',
        description: 'Failed to add expenses. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [routeConfig?.expenses, selectedExpenses, tripId, route, toast, onExpensesAdded]);

  // Don't render if no route or loading
  if (!route) return null;
  if (isLoading) {
    return (
      <Card className="border-dashed border-blue-200 bg-blue-50/30">
        <CardContent className="py-6 flex items-center justify-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
          <span className="text-sm text-blue-600">Loading route expenses...</span>
        </CardContent>
      </Card>
    );
  }

  // No config found for this route
  if (!routeConfig) {
    return (
      <Card className="border-dashed border-gray-200">
        <CardContent className="py-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">No pre-defined expenses configured for route: {route}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  // All expenses already added
  if (missingExpenses.length === 0) {
    return (
      <Card className="border-green-200 bg-green-50/30">
        <CardContent className="py-4">
          <div className="flex items-center gap-2 text-green-700">
            <CheckCircle2 className="h-4 w-4" />
            <span className="text-sm font-medium">
              All pre-defined expenses for this route have been added
            </span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="border-blue-200 bg-gradient-to-br from-blue-50/50 to-indigo-50/30">
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-blue-50/50 transition-colors rounded-t-lg pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Sparkles className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <CardTitle className="text-base">Pre-defined Route Expenses</CardTitle>
                  <CardDescription className="flex items-center gap-1 mt-1">
                    <MapPin className="h-3 w-3" />
                    {routeConfig.route}
                    {routeConfig.description && (
                      <span className="text-xs">• {routeConfig.description}</span>
                    )}
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="bg-white">
                  {missingExpenses.length} expense(s) available
                </Badge>
                <ChevronDown
                  className={cn(
                    'h-4 w-4 text-muted-foreground transition-transform',
                    isOpen && 'rotate-180'
                  )}
                />
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-2">
            {/* Quick Actions */}
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSelectAll}
                disabled={selectedExpenses.size === missingExpenses.length}
              >
                Select All
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSelectRequired}
                disabled={
                  routeConfig.expenses.filter(
                    (e, i) => e.is_required && !expenseStatus.get(i)
                  ).length === 0
                }
              >
                Select Required
              </Button>
              {selectedExpenses.size > 0 && (
                <Button variant="ghost" size="sm" onClick={handleClearSelection}>
                  Clear Selection
                </Button>
              )}
            </div>

            {/* Expense Items */}
            <div className="space-y-2">
              {routeConfig.expenses?.map((expense, index) => {
                const isAdded = expenseStatus.get(index);
                const isSelected = selectedExpenses.has(index);

                return (
                  <ExpenseItem
                    key={index}
                    expense={expense}
                    isAdded={isAdded || false}
                    isSelected={isSelected}
                    onToggle={() => handleToggleExpense(index)}
                    route={route}
                  />
                );
              })}
            </div>

            {/* Summary & Action */}
            {selectedExpenses.size > 0 && (
              <>
                <Separator className="my-4" />
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">
                      Selected: {selectedExpenses.size} expense(s)
                    </p>
                    <div className="flex gap-2 text-sm text-muted-foreground">
                      {totals.selected > 0 && (
                        <span className="flex items-center gap-1">
                          <DollarSign className="h-3 w-3" />
                          {formatExpenseAmount(totals.selected, 'USD')}
                        </span>
                      )}
                    </div>
                  </div>
                  <Button onClick={handleAddSelectedExpenses} disabled={isSubmitting}>
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Adding...
                      </>
                    ) : (
                      <>
                        <Plus className="mr-2 h-4 w-4" />
                        Add Selected Expenses
                      </>
                    )}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};

// Individual expense item component
interface ExpenseItemProps {
  expense: RouteExpense;
  isAdded: boolean;
  isSelected: boolean;
  onToggle: () => void;
  route: string;
}

const ExpenseItem = ({ expense, isAdded, isSelected, onToggle, route }: ExpenseItemProps) => {
  return (
    <div
      className={cn(
        'flex items-center justify-between p-3 rounded-lg border transition-all',
        isAdded
          ? 'bg-green-50 border-green-200 opacity-60'
          : isSelected
            ? 'bg-blue-50 border-blue-300 shadow-sm'
            : 'bg-white border-gray-200 hover:border-gray-300'
      )}
    >
      <div className="flex items-center gap-3">
        {!isAdded && (
          <Checkbox
            checked={isSelected}
            onCheckedChange={onToggle}
            className="data-[state=checked]:bg-blue-600"
          />
        )}
        {isAdded && <CheckCircle2 className="h-4 w-4 text-green-600" />}

        <div>
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={cn('text-xs', getExpenseBadgeColor(expense.category))}
            >
              {expense.category}
            </Badge>
            <span className="text-sm font-medium">{expense.sub_category}</span>
            {expense.is_required && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-800">
                      Required
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">This is a required expense for the {route} route</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          {expense.description && (
            <p className="text-xs text-muted-foreground mt-1">{expense.description}</p>
          )}
        </div>
      </div>

      <div className="text-right">
        <span
          className={cn(
            'font-mono font-semibold',
            isAdded ? 'text-green-600' : 'text-gray-900'
          )}
        >
          {formatExpenseAmount(expense.amount, expense.currency)}
        </span>
        {isAdded && (
          <p className="text-xs text-green-600 mt-0.5">Already added</p>
        )}
      </div>
    </div>
  );
};

export default RouteExpensesSuggestor;
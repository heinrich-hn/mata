import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import
  {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
  } from '@/components/ui/command';
import
  {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
  } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import
  {
    Popover,
    PopoverContent,
    PopoverTrigger,
  } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import
  {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
  } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import
  {
    formatTotalCost,
    getMainCategories,
    getSubCategories,
    RouteExpenseConfig,
    RouteExpenseItem,
    useAddRouteExpenseConfig,
    useRoutePredefinedExpenses,
    useUpdateRouteExpenseConfig
  } from '@/hooks/useRoutePredefinedExpenses';
import
  {
    DbRouteTollCost,
    useAddRouteTollCost,
    useRouteTollCosts,
    useUpdateRouteTollCost,
  } from '@/hooks/useRouteTollCosts';
import { cn } from '@/lib/utils';
import { Check, ChevronsUpDown, Edit2, Loader2, Plus, Route, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';

// Empty expense item template
const emptyExpenseItem: Omit<RouteExpenseItem, 'id' | 'route_config_id'> = {
  category: '',
  sub_category: '',
  amount: 0,
  currency: 'USD',
  is_required: true,
  description: '',
};

interface RouteSelectProps {
  value?: string;
  onValueChange: (value: string, tollCost?: { amount: number; currency: string }, expenses?: RouteExpenseItem[]) => void;
  placeholder?: string;
  disabled?: boolean;
  showTollFee?: boolean;
  allowCreate?: boolean;
  allowEdit?: boolean;
}

export const RouteSelect = ({
  value,
  onValueChange,
  placeholder = 'Select route...',
  disabled = false,
  showTollFee = true,
  allowCreate = true,
  allowEdit = true,
}: RouteSelectProps) => {
  const { toast } = useToast();

  // Fetch from both old toll costs and new predefined expenses
  const { data: routes = [], isLoading, error } = useRouteTollCosts();
  const { data: predefinedExpenses = [] } = useRoutePredefinedExpenses();

  // Mutations for old system (backward compat)
  const addMutation = useAddRouteTollCost();
  const updateMutation = useUpdateRouteTollCost();

  // Mutations for new expense system
  const addExpenseConfigMutation = useAddRouteExpenseConfig();
  const updateExpenseConfigMutation = useUpdateRouteExpenseConfig();

  const [open, setOpen] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingRoute, setEditingRoute] = useState<DbRouteTollCost | null>(null);
  const [editingExpenseConfig, setEditingExpenseConfig] = useState<RouteExpenseConfig | null>(null);

  // Form state for basic route info
  const [newRoute, setNewRoute] = useState({
    route: '',
    toll_fee: '',
    currency: 'USD' as 'USD' | 'ZAR',
    description: '',
  });

  // State for managing multiple expense items
  const [expenseItems, setExpenseItems] = useState<Omit<RouteExpenseItem, 'id' | 'route_config_id'>[]>([]);
  const [showExpenseEditor, setShowExpenseEditor] = useState(false);

  // Reset form when dialog closes
  useEffect(() => {
    if (!isAddDialogOpen) {
      setNewRoute({ route: '', toll_fee: '', currency: 'USD', description: '' });
      setExpenseItems([]);
      setShowExpenseEditor(false);
    }
  }, [isAddDialogOpen]);

  // Populate edit form when opening edit dialog
  useEffect(() => {
    if (editingRoute) {
      setNewRoute({
        route: editingRoute.route,
        toll_fee: editingRoute.toll_fee.toString(),
        currency: editingRoute.currency,
        description: editingRoute.description || '',
      });

      // Check if there's predefined expenses for this route
      const existingConfig = predefinedExpenses.find(c => c.route === editingRoute.route);
      if (existingConfig) {
        setEditingExpenseConfig(existingConfig);
        setExpenseItems(existingConfig.expenses.map(e => ({
          category: e.category,
          sub_category: e.sub_category,
          amount: e.amount,
          currency: e.currency,
          is_required: e.is_required,
          description: e.description,
        })));
        setShowExpenseEditor(true);
      } else {
        setEditingExpenseConfig(null);
        // Pre-populate with toll fee as first expense item
        setExpenseItems([{
          category: 'Tolls',
          sub_category: 'Route Toll Fee',
          amount: editingRoute.toll_fee,
          currency: editingRoute.currency,
          is_required: true,
          description: '',
        }]);
        setShowExpenseEditor(false);
      }
    }
  }, [editingRoute, predefinedExpenses]);

  const selectedRoute = routes.find((r) => r.route === value);

  // Get predefined expenses for selected route (for future use)
  const _selectedRouteExpenses = predefinedExpenses.find(c => c.route === value)?.expenses || [];

  // Format currency for display
  const formatCurrency = (amount: number, currency: string) => {
    const symbol = currency === 'USD' ? '$' : 'R';
    return `${symbol}${amount.toLocaleString()}`;
  };

  const handleSelectRoute = (route: DbRouteTollCost) => {
    // Find predefined expenses for this route
    const routeExpenses = predefinedExpenses.find(c => c.route === route.route)?.expenses || [];
    onValueChange(route.route, { amount: route.toll_fee, currency: route.currency }, routeExpenses);
    setOpen(false);
  };

  // Add a new expense item to the list
  const addExpenseItem = () => {
    setExpenseItems(prev => [...prev, { ...emptyExpenseItem }]);
  };

  // Remove an expense item from the list
  const removeExpenseItem = (index: number) => {
    setExpenseItems(prev => prev.filter((_, i) => i !== index));
  };

  // Update a specific expense item
  const updateExpenseItem = (index: number, field: keyof RouteExpenseItem, value: string | number | boolean) => {
    setExpenseItems(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      // Reset sub_category when category changes
      if (field === 'category') {
        updated[index].sub_category = '';
      }
      return updated;
    });
  };

  // Get available subcategories for an expense item
  const getAvailableSubCategories = (category: string): string[] => {
    return getSubCategories(category);
  };

  const handleAddRoute = async () => {
    if (!newRoute.route.trim()) {
      toast({
        title: 'Error',
        description: 'Route name is required',
        variant: 'destructive',
      });
      return;
    }

    // Calculate toll fee from expense items if any, or use simple toll fee
    let tollFee = parseFloat(newRoute.toll_fee) || 0;
    const validExpenses = expenseItems.filter(e => e.category && e.sub_category && e.amount > 0);

    if (showExpenseEditor && validExpenses.length > 0) {
      // Calculate toll fee as sum of all expenses (for backward compat display)
      tollFee = validExpenses
        .filter(e => e.currency === newRoute.currency)
        .reduce((sum, e) => sum + e.amount, 0);
    }

    if (tollFee < 0) {
      toast({
        title: 'Error',
        description: 'Please enter valid expense amounts',
        variant: 'destructive',
      });
      return;
    }

    try {
      // Add to old toll costs system (backward compat)
      await addMutation.mutateAsync({
        route: newRoute.route.trim().toUpperCase(),
        toll_fee: tollFee,
        currency: newRoute.currency,
        description: newRoute.description.trim() || undefined,
      });

      // Also add to new expense config system if we have expense items
      if (showExpenseEditor && validExpenses.length > 0) {
        try {
          await addExpenseConfigMutation.mutateAsync({
            route: newRoute.route.trim().toUpperCase(),
            description: newRoute.description.trim() || undefined,
            expenses: validExpenses,
          });
        } catch (e) {
          // Log but don't fail - the old system worked
          console.warn('Failed to add expense config:', e);
        }
      }

      setIsAddDialogOpen(false);
      // Automatically select the new route
      onValueChange(newRoute.route.trim().toUpperCase(), { amount: tollFee, currency: newRoute.currency }, validExpenses);
    } catch {
      // Error handled by mutation
    }
  };

  const handleEditRoute = async () => {
    if (!editingRoute) return;

    // Calculate toll fee from expense items if any
    let tollFee = parseFloat(newRoute.toll_fee) || 0;
    const validExpenses = expenseItems.filter(e => e.category && e.sub_category && e.amount > 0);

    if (showExpenseEditor && validExpenses.length > 0) {
      tollFee = validExpenses
        .filter(e => e.currency === newRoute.currency)
        .reduce((sum, e) => sum + e.amount, 0);
    }

    if (tollFee < 0) {
      toast({
        title: 'Error',
        description: 'Please enter valid expense amounts',
        variant: 'destructive',
      });
      return;
    }

    try {
      // Update old toll costs system
      await updateMutation.mutateAsync({
        id: editingRoute.id,
        toll_fee: tollFee,
        currency: newRoute.currency,
        description: newRoute.description.trim() || null,
      });

      // Update or create expense config if we have expense items
      if (showExpenseEditor && validExpenses.length > 0) {
        try {
          if (editingExpenseConfig) {
            // Update existing config
            await updateExpenseConfigMutation.mutateAsync({
              id: editingExpenseConfig.id,
              description: newRoute.description.trim() || undefined,
              expenses: validExpenses,
            });
          } else {
            // Create new config for this route
            await addExpenseConfigMutation.mutateAsync({
              route: editingRoute.route,
              description: newRoute.description.trim() || undefined,
              expenses: validExpenses,
            });
          }
        } catch (e) {
          console.warn('Failed to update expense config:', e);
        }
      }

      setIsEditDialogOpen(false);
      setEditingRoute(null);
      setEditingExpenseConfig(null);
    } catch {
      // Error handled by mutation
    }
  };

  const openEditDialog = (route: DbRouteTollCost, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingRoute(route);
    setIsEditDialogOpen(true);
  };

  if (error) {
    return (
      <div className="text-sm text-destructive">
        Error loading routes: {error.message}
      </div>
    );
  }

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled || isLoading}
            className="w-full justify-between"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading routes...
              </span>
            ) : selectedRoute ? (
              <span className="flex items-center gap-2">
                <Route className="h-4 w-4 text-muted-foreground" />
                <span>{selectedRoute.route}</span>
                {showTollFee && (
                  <Badge variant="secondary" className="ml-2">
                    {formatCurrency(selectedRoute.toll_fee, selectedRoute.currency)}
                  </Badge>
                )}
              </span>
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[350px] p-0" align="start">
          <Command className="overflow-visible">
            <CommandInput placeholder="Search routes..." className="h-9" />
            <CommandList className="max-h-[250px] overflow-y-auto">
              <CommandEmpty>
                <div className="py-3 text-center">
                  <p className="text-sm text-muted-foreground">No routes found.</p>
                  {allowCreate && (
                    <Button
                      variant="link"
                      size="sm"
                      className="mt-1"
                      onClick={() => {
                        setOpen(false);
                        setIsAddDialogOpen(true);
                      }}
                    >
                      <Plus className="mr-1 h-3 w-3" />
                      Add new route
                    </Button>
                  )}
                </div>
              </CommandEmpty>
              <CommandGroup heading="Available Routes">
                {routes.map((route) => (
                  <CommandItem
                    key={route.id}
                    value={route.route}
                    onSelect={() => handleSelectRoute(route)}
                    className="flex items-center justify-between cursor-pointer py-2"
                  >
                    <div className="flex items-center gap-2">
                      <Check
                        className={cn(
                          "h-3 w-3 shrink-0",
                          value === route.route ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <Route className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="text-sm">{route.route}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Badge variant="outline" className="font-mono text-xs px-1.5 py-0">
                        {formatCurrency(route.toll_fee, route.currency)}
                      </Badge>
                      {allowEdit && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 w-5 p-0"
                          onClick={(e) => openEditDialog(route, e)}
                        >
                          <Edit2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
              {allowCreate && (
                <>
                  <CommandSeparator />
                  <CommandGroup>
                    <CommandItem
                      onSelect={() => {
                        setOpen(false);
                        setIsAddDialogOpen(true);
                      }}
                      className="cursor-pointer py-2"
                    >
                      <Plus className="mr-2 h-3 w-3" />
                      <span className="text-sm">Add new route</span>
                    </CommandItem>
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Add Route Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Route</DialogTitle>
            <DialogDescription>
              Create a new route with predefined costs. These costs will be automatically suggested when creating trips using this route.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="route-name">Route Name *</Label>
              <Input
                id="route-name"
                placeholder="e.g., HRE - BYO"
                value={newRoute.route}
                onChange={(e) => setNewRoute((prev) => ({ ...prev, route: e.target.value.toUpperCase() }))}
                onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
              />
              <p className="text-xs text-muted-foreground">
                Use format: ORIGIN - DESTINATION (e.g., CBC - BV)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Input
                id="description"
                placeholder="e.g., Harare to Bulawayo via main highway"
                value={newRoute.description}
                onChange={(e) => setNewRoute((prev) => ({ ...prev, description: e.target.value }))}
                onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
              />
            </div>

            {/* Simple Toll Fee Mode */}
            {!showExpenseEditor && (
              <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Quick Toll Fee Entry</Label>
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    className="text-xs"
                    onClick={() => {
                      setShowExpenseEditor(true);
                      if (newRoute.toll_fee) {
                        setExpenseItems([{
                          category: 'Tolls',
                          sub_category: 'Route Toll Fee',
                          amount: parseFloat(newRoute.toll_fee) || 0,
                          currency: newRoute.currency,
                          is_required: true,
                          description: '',
                        }]);
                      }
                    }}
                  >
                    + Add multiple expense categories
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="toll-fee">Toll Fee *</Label>
                    <Input
                      id="toll-fee"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={newRoute.toll_fee}
                      onChange={(e) => setNewRoute((prev) => ({ ...prev, toll_fee: e.target.value }))}
                      onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="currency">Currency</Label>
                    <Select
                      value={newRoute.currency}
                      onValueChange={(val: 'USD' | 'ZAR') => setNewRoute((prev) => ({ ...prev, currency: val }))}
                    >
                      <SelectTrigger id="currency">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="USD">USD ($)</SelectItem>
                        <SelectItem value="ZAR">ZAR (R)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}

            {/* Advanced Expense Editor Mode */}
            {showExpenseEditor && (
              <div className="space-y-4 border rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Route Expense Categories</Label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setShowExpenseEditor(false);
                        // Convert first expense back to simple toll fee
                        if (expenseItems.length > 0) {
                          const first = expenseItems[0];
                          setNewRoute(prev => ({
                            ...prev,
                            toll_fee: first.amount.toString(),
                            currency: first.currency,
                          }));
                        }
                      }}
                    >
                      <X className="h-3 w-3 mr-1" />
                      Simple Mode
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addExpenseItem}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Add Expense
                    </Button>
                  </div>
                </div>

                <ScrollArea className="max-h-[300px]">
                  <div className="space-y-3 pr-4">
                    {expenseItems.map((item, index) => (
                      <Card key={index} className="p-3 bg-background">
                        <div className="grid grid-cols-12 gap-2 items-end">
                          {/* Category */}
                          <div className="col-span-3 space-y-1">
                            <Label className="text-xs">Category</Label>
                            <Select
                              value={item.category}
                              onValueChange={(val) => updateExpenseItem(index, 'category', val)}
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder="Select..." />
                              </SelectTrigger>
                              <SelectContent>
                                {getMainCategories().map((cat) => (
                                  <SelectItem key={cat} value={cat} className="text-xs">
                                    {cat}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Sub-category */}
                          <div className="col-span-3 space-y-1">
                            <Label className="text-xs">Sub-category</Label>
                            <Select
                              value={item.sub_category}
                              onValueChange={(val) => updateExpenseItem(index, 'sub_category', val)}
                              disabled={!item.category}
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder="Select..." />
                              </SelectTrigger>
                              <SelectContent>
                                {getAvailableSubCategories(item.category).map((sub) => (
                                  <SelectItem key={sub} value={sub} className="text-xs">
                                    {sub}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Amount */}
                          <div className="col-span-2 space-y-1">
                            <Label className="text-xs">Amount</Label>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              className="h-8 text-xs"
                              value={item.amount || ''}
                              onChange={(e) => updateExpenseItem(index, 'amount', parseFloat(e.target.value) || 0)}
                              onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
                            />
                          </div>

                          {/* Currency */}
                          <div className="col-span-2 space-y-1">
                            <Label className="text-xs">Currency</Label>
                            <Select
                              value={item.currency}
                              onValueChange={(val: 'USD' | 'ZAR') => updateExpenseItem(index, 'currency', val)}
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="USD">USD</SelectItem>
                                <SelectItem value="ZAR">ZAR</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Required Toggle & Delete */}
                          <div className="col-span-2 flex items-center justify-end gap-2">
                            <div className="flex items-center gap-1">
                              <Switch
                                checked={item.is_required}
                                onCheckedChange={(val) => updateExpenseItem(index, 'is_required', val)}
                                className="h-4 w-7 data-[state=checked]:bg-green-600"
                              />
                              <span className="text-xs text-muted-foreground">Req</span>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => removeExpenseItem(index)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </Card>
                    ))}

                    {expenseItems.length === 0 && (
                      <div className="text-center py-4 text-muted-foreground text-sm">
                        No expense items added. Click "Add Expense" to add cost categories.
                      </div>
                    )}
                  </div>
                </ScrollArea>

                {expenseItems.length > 0 && (
                  <div className="flex justify-end pt-2 border-t text-sm">
                    <span className="text-muted-foreground">
                      Total: <strong>{formatTotalCost(expenseItems as RouteExpenseItem[])}</strong>
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleAddRoute} disabled={addMutation.isPending || addExpenseConfigMutation.isPending}>
              {(addMutation.isPending || addExpenseConfigMutation.isPending) ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Route
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Route Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Route Costs</DialogTitle>
            <DialogDescription>
              Update the predefined costs for this route. Changes will only apply to future trips.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Route</Label>
              <div className="p-3 bg-muted rounded-md font-mono">
                {editingRoute?.route}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-description">Description (Optional)</Label>
              <Input
                id="edit-description"
                placeholder="Route description"
                value={newRoute.description}
                onChange={(e) => setNewRoute((prev) => ({ ...prev, description: e.target.value }))}
                onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
              />
            </div>

            {/* Simple Toll Fee Mode */}
            {!showExpenseEditor && (
              <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Quick Toll Fee</Label>
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    className="text-xs"
                    onClick={() => {
                      setShowExpenseEditor(true);
                      if (expenseItems.length === 0 && newRoute.toll_fee) {
                        setExpenseItems([{
                          category: 'Tolls',
                          sub_category: 'Route Toll Fee',
                          amount: parseFloat(newRoute.toll_fee) || 0,
                          currency: newRoute.currency,
                          is_required: true,
                          description: '',
                        }]);
                      }
                    }}
                  >
                    + Add multiple expense categories
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-toll-fee">Toll Fee *</Label>
                    <Input
                      id="edit-toll-fee"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={newRoute.toll_fee}
                      onChange={(e) => setNewRoute((prev) => ({ ...prev, toll_fee: e.target.value }))}
                      onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-currency">Currency</Label>
                    <Select
                      value={newRoute.currency}
                      onValueChange={(val: 'USD' | 'ZAR') => setNewRoute((prev) => ({ ...prev, currency: val }))}
                    >
                      <SelectTrigger id="edit-currency">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="USD">USD ($)</SelectItem>
                        <SelectItem value="ZAR">ZAR (R)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}

            {/* Advanced Expense Editor Mode */}
            {showExpenseEditor && (
              <div className="space-y-4 border rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Route Expense Categories</Label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setShowExpenseEditor(false);
                        // Calculate total for simple mode
                        if (expenseItems.length > 0) {
                          const total = expenseItems
                            .filter(e => e.currency === newRoute.currency)
                            .reduce((sum, e) => sum + e.amount, 0);
                          setNewRoute(prev => ({
                            ...prev,
                            toll_fee: total.toString(),
                          }));
                        }
                      }}
                    >
                      <X className="h-3 w-3 mr-1" />
                      Simple Mode
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addExpenseItem}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Add Expense
                    </Button>
                  </div>
                </div>

                <ScrollArea className="max-h-[300px]">
                  <div className="space-y-3 pr-4">
                    {expenseItems.map((item, index) => (
                      <Card key={index} className="p-3 bg-background">
                        <div className="grid grid-cols-12 gap-2 items-end">
                          {/* Category */}
                          <div className="col-span-3 space-y-1">
                            <Label className="text-xs">Category</Label>
                            <Select
                              value={item.category}
                              onValueChange={(val) => updateExpenseItem(index, 'category', val)}
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder="Select..." />
                              </SelectTrigger>
                              <SelectContent>
                                {getMainCategories().map((cat) => (
                                  <SelectItem key={cat} value={cat} className="text-xs">
                                    {cat}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Sub-category */}
                          <div className="col-span-3 space-y-1">
                            <Label className="text-xs">Sub-category</Label>
                            <Select
                              value={item.sub_category}
                              onValueChange={(val) => updateExpenseItem(index, 'sub_category', val)}
                              disabled={!item.category}
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder="Select..." />
                              </SelectTrigger>
                              <SelectContent>
                                {getAvailableSubCategories(item.category).map((sub) => (
                                  <SelectItem key={sub} value={sub} className="text-xs">
                                    {sub}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Amount */}
                          <div className="col-span-2 space-y-1">
                            <Label className="text-xs">Amount</Label>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              className="h-8 text-xs"
                              value={item.amount || ''}
                              onChange={(e) => updateExpenseItem(index, 'amount', parseFloat(e.target.value) || 0)}
                              onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
                            />
                          </div>

                          {/* Currency */}
                          <div className="col-span-2 space-y-1">
                            <Label className="text-xs">Currency</Label>
                            <Select
                              value={item.currency}
                              onValueChange={(val: 'USD' | 'ZAR') => updateExpenseItem(index, 'currency', val)}
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="USD">USD</SelectItem>
                                <SelectItem value="ZAR">ZAR</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Required Toggle & Delete */}
                          <div className="col-span-2 flex items-center justify-end gap-2">
                            <div className="flex items-center gap-1">
                              <Switch
                                checked={item.is_required}
                                onCheckedChange={(val) => updateExpenseItem(index, 'is_required', val)}
                                className="h-4 w-7 data-[state=checked]:bg-green-600"
                              />
                              <span className="text-xs text-muted-foreground">Req</span>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => removeExpenseItem(index)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </Card>
                    ))}

                    {expenseItems.length === 0 && (
                      <div className="text-center py-4 text-muted-foreground text-sm">
                        No expense items. Click "Add Expense" to add cost categories.
                      </div>
                    )}
                  </div>
                </ScrollArea>

                {expenseItems.length > 0 && (
                  <div className="flex justify-end pt-2 border-t text-sm">
                    <span className="text-muted-foreground">
                      Total: <strong>{formatTotalCost(expenseItems as RouteExpenseItem[])}</strong>
                    </span>
                  </div>
                )}
              </div>
            )}

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-md">
              <p className="text-sm text-amber-800">
                <strong>Note:</strong> Updating costs will only affect new trips. Existing trip costs will not be changed.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleEditRoute} disabled={updateMutation.isPending || updateExpenseConfigMutation.isPending}>
              {(updateMutation.isPending || updateExpenseConfigMutation.isPending) ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { DatePicker } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { COST_CATEGORIES } from '@/constants/costCategories';
import { ChevronDown, ChevronUp, DollarSign, Flag, Plus, Receipt, Trash2, X } from 'lucide-react';
import { useState } from 'react';

export interface TripCostEntry {
  id: string;
  category: string;
  sub_category: string;
  amount: number;
  currency: string;
  reference_number: string;
  date: string;
  notes: string;
  is_flagged: boolean;
  flag_reason: string;
}

interface TripCostSectionProps {
  costs: TripCostEntry[];
  onCostsChange: (costs: TripCostEntry[]) => void;
  departureDate?: string;
}

const generateId = () => `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

const emptyCostEntry = (date: string): TripCostEntry => ({
  id: generateId(),
  category: '',
  sub_category: '',
  amount: 0,
  currency: 'ZAR',
  reference_number: '',
  date: date || new Date().toISOString().split('T')[0],
  notes: '',
  is_flagged: false,
  flag_reason: '',
});

const TripCostSection = ({ costs, onCostsChange, departureDate }: TripCostSectionProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [currentCost, setCurrentCost] = useState<TripCostEntry>(emptyCostEntry(departureDate || ''));
  const [availableSubCategories, setAvailableSubCategories] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleCategoryChange = (category: string) => {
    const subCategories = COST_CATEGORIES[category as keyof typeof COST_CATEGORIES] || [];
    setAvailableSubCategories([...subCategories]);
    setCurrentCost(prev => ({ ...prev, category, sub_category: '' }));
    if (errors.category) {
      setErrors(prev => ({ ...prev, category: '' }));
    }
  };

  const handleFieldChange = (field: keyof TripCostEntry, value: string | number | boolean) => {
    setCurrentCost(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validateCost = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!currentCost.category) newErrors.category = 'Category is required';
    if (!currentCost.sub_category) newErrors.sub_category = 'Sub-category is required';
    if (!currentCost.amount || currentCost.amount <= 0) newErrors.amount = 'Valid amount is required';
    if (!currentCost.reference_number.trim()) newErrors.reference_number = 'Reference number is required';
    if (!currentCost.date) newErrors.date = 'Date is required';
    if (currentCost.is_flagged && !currentCost.flag_reason.trim()) {
      newErrors.flag_reason = 'Flag reason is required when flagging a cost';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleAddCost = () => {
    if (!validateCost()) return;

    // Check if category is high-risk
    const highRiskCategories = ['Non-Value-Added Costs', 'Border Costs'];
    const isHighRisk = highRiskCategories.includes(currentCost.category);

    const costToAdd: TripCostEntry = {
      ...currentCost,
      id: generateId(),
      is_flagged: currentCost.is_flagged || isHighRisk,
      flag_reason: currentCost.is_flagged
        ? currentCost.flag_reason
        : isHighRisk
          ? `High-risk category: ${currentCost.category} - ${currentCost.sub_category} requires review`
          : '',
    };

    onCostsChange([...costs, costToAdd]);
    setCurrentCost(emptyCostEntry(departureDate || ''));
    setShowAddForm(false);
    setAvailableSubCategories([]);
    setErrors({});
  };

  const handleRemoveCost = (id: string) => {
    onCostsChange(costs.filter(c => c.id !== id));
  };

  const formatCurrency = (amount: number, currency: string) => {
    const symbol = currency === 'USD' ? '$' : 'R';
    return `${symbol}${amount.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Calculate totals
  const totalZAR = costs.filter(c => c.currency === 'ZAR').reduce((sum, c) => sum + c.amount, 0);
  const totalUSD = costs.filter(c => c.currency === 'USD').reduce((sum, c) => sum + c.amount, 0);
  const flaggedCount = costs.filter(c => c.is_flagged).length;

  return (
    <div className="space-y-4 border rounded-lg p-4 bg-muted/30">
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <div className="flex items-center justify-between">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-2 p-0 h-auto hover:bg-transparent">
              <Receipt className="h-4 w-4" />
              <h4 className="font-medium text-sm">Trip Costs</h4>
              {costs.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {costs.length} {costs.length === 1 ? 'cost' : 'costs'}
                </Badge>
              )}
              {isExpanded ? (
                <ChevronUp className="h-4 w-4 ml-1" />
              ) : (
                <ChevronDown className="h-4 w-4 ml-1" />
              )}
            </Button>
          </CollapsibleTrigger>
          <span className="text-xs text-muted-foreground">
            Optional - Add costs incurred during this trip
          </span>
        </div>

        <CollapsibleContent className="mt-4 space-y-4">
          {/* Cost Summary */}
          {costs.length > 0 && (
            <Card className="bg-background">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <DollarSign className="h-4 w-4 text-green-600" />
                  <span className="font-medium text-sm">Cost Summary</span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Total (ZAR):</span>
                    <p className="font-semibold text-green-700">{formatCurrency(totalZAR, 'ZAR')}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Total (USD):</span>
                    <p className="font-semibold text-blue-700">{formatCurrency(totalUSD, 'USD')}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Entries:</span>
                    <p className="font-semibold">{costs.length}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Flagged:</span>
                    <p className={`font-semibold ${flaggedCount > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                      {flaggedCount}
                    </p>
                  </div>
                </div>

                <Separator className="my-3" />

                {/* Cost List */}
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {costs.map((cost) => (
                    <div
                      key={cost.id}
                      className="flex items-center justify-between p-2 bg-muted/50 rounded-md text-sm"
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {cost.is_flagged && (
                          <Flag className="h-3 w-3 text-amber-500 flex-shrink-0" />
                        )}
                        <span className="truncate">
                          {cost.category} - {cost.sub_category}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-mono">
                          {formatCurrency(cost.amount, cost.currency)}
                        </Badge>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-destructive hover:text-destructive/90"
                          onClick={() => handleRemoveCost(cost.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Add Cost Form */}
          {showAddForm ? (
            <Card className="bg-background border-dashed">
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">Add Cost Entry</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowAddForm(false);
                      setCurrentCost(emptyCostEntry(departureDate || ''));
                      setErrors({});
                      setAvailableSubCategories([]);
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Category *</Label>
                    <Select
                      value={currentCost.category}
                      onValueChange={handleCategoryChange}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select category..." />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.keys(COST_CATEGORIES).map(key => (
                          <SelectItem key={key} value={key}>{key}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.category && <p className="text-xs text-destructive">{errors.category}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label>Sub-category *</Label>
                    <Select
                      value={currentCost.sub_category}
                      onValueChange={(val) => handleFieldChange('sub_category', val)}
                      disabled={!currentCost.category}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select sub-category..." />
                      </SelectTrigger>
                      <SelectContent>
                        {availableSubCategories.map(sub => (
                          <SelectItem key={sub} value={sub}>{sub}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.sub_category && <p className="text-xs text-destructive">{errors.sub_category}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Amount *</Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={currentCost.amount || ''}
                      onChange={(e) => handleFieldChange('amount', parseFloat(e.target.value) || 0)}
                    />
                    {errors.amount && <p className="text-xs text-destructive">{errors.amount}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label>Currency</Label>
                    <Select
                      value={currentCost.currency}
                      onValueChange={(val) => handleFieldChange('currency', val)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ZAR">ZAR (R)</SelectItem>
                        <SelectItem value="USD">USD ($)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Date *</Label>
                    <DatePicker
                      value={currentCost.date}
                      onChange={(date) => {
                        if (date) {
                          const year = date.getFullYear();
                          const month = String(date.getMonth() + 1).padStart(2, '0');
                          const day = String(date.getDate()).padStart(2, '0');
                          handleFieldChange('date', `${year}-${month}-${day}`);
                        } else {
                          handleFieldChange('date', '');
                        }
                      }}
                      placeholder="Select date"
                    />
                    {errors.date && <p className="text-xs text-destructive">{errors.date}</p>}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Reference Number *</Label>
                  <Input
                    placeholder="Invoice/receipt number"
                    value={currentCost.reference_number}
                    onChange={(e) => handleFieldChange('reference_number', e.target.value)}
                  />
                  {errors.reference_number && <p className="text-xs text-destructive">{errors.reference_number}</p>}
                </div>

                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea
                    placeholder="Additional notes about this cost..."
                    value={currentCost.notes}
                    onChange={(e) => handleFieldChange('notes', e.target.value)}
                    rows={2}
                  />
                </div>

                <div className="border rounded-md p-3 space-y-2 bg-muted/30">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="flag-cost"
                      checked={currentCost.is_flagged}
                      onCheckedChange={(checked) => handleFieldChange('is_flagged', checked as boolean)}
                    />
                    <Label htmlFor="flag-cost" className="flex items-center cursor-pointer text-sm">
                      <Flag className="w-3 h-3 mr-1" />
                      Flag this cost for investigation
                    </Label>
                  </div>

                  {currentCost.is_flagged && (
                    <div className="space-y-1">
                      <Textarea
                        placeholder="Reason for flagging this cost..."
                        value={currentCost.flag_reason}
                        onChange={(e) => handleFieldChange('flag_reason', e.target.value)}
                        rows={2}
                        className="text-sm"
                      />
                      {errors.flag_reason && <p className="text-xs text-destructive">{errors.flag_reason}</p>}
                    </div>
                  )}

                  <p className="text-xs text-muted-foreground">
                    Note: High-risk categories (Non-Value-Added Costs, Border Costs) are automatically flagged for review.
                  </p>
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowAddForm(false);
                      setCurrentCost(emptyCostEntry(departureDate || ''));
                      setErrors({});
                      setAvailableSubCategories([]);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="button" size="sm" onClick={handleAddCost}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add Cost
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Button
              type="button"
              variant="outline"
              className="w-full border-dashed"
              onClick={() => setShowAddForm(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Cost Entry
            </Button>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};

export default TripCostSection;
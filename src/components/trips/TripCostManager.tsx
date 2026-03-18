import { CostForm } from '@/components/costs/CostForm';
import RouteExpensesSuggestor from '@/components/costs/RouteExpensesSuggestor';
import
  {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
  } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useOperations } from '@/contexts/OperationsContext';
import { toast } from '@/hooks/use-toast';
import { CostEntry } from '@/types/operations';
import { AlertTriangle, CheckCircle, Edit, FileText, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface TripCostManagerProps {
  tripId: string;
  route?: string | null;
  costs: CostEntry[];
  onRefresh: () => void;
  onResolveFlag: (cost: CostEntry) => void;
}

const TripCostManager = ({ tripId, route, costs, onRefresh, onResolveFlag }: TripCostManagerProps) => {
  const [showCostForm, setShowCostForm] = useState(false);
  const [selectedCost, setSelectedCost] = useState<CostEntry | null>(null);
  const [costToDelete, setCostToDelete] = useState<CostEntry | null>(null);
  const [costToApprove, setCostToApprove] = useState<CostEntry | null>(null);
  const [isApproving, setIsApproving] = useState(false);
  const { deleteCostEntry } = useOperations();
  const { user } = useAuth();

  const handleDelete = async () => {
    if (!costToDelete) return;

    try {
      await deleteCostEntry(costToDelete.id);
      toast({
        title: "Success",
        description: "Cost entry deleted successfully",
      });
      setCostToDelete(null);
      onRefresh();
    } catch {
      toast({
        title: "Error",
        description: "Failed to delete cost entry",
        variant: "destructive",
      });
    }
  };

  const handleApproveCost = async () => {
    if (!costToApprove) return;

    setIsApproving(true);
    try {
      const { error } = await supabase
        .from('cost_entries')
        .update({
          investigation_status: 'resolved',
          investigation_notes: costToApprove.investigation_notes
            ? `${costToApprove.investigation_notes}\n\n--- APPROVED ---\nApproved by ${user?.email || 'admin'} on ${new Date().toLocaleDateString('en-ZA')}`
            : `Approved by ${user?.email || 'admin'} on ${new Date().toLocaleDateString('en-ZA')}`,
          resolved_at: new Date().toISOString(),
          resolved_by: user?.email || 'admin',
        })
        .eq('id', costToApprove.id);

      if (error) throw error;

      toast({
        title: 'Cost Approved',
        description: `${costToApprove.category}${costToApprove.sub_category ? ' – ' + costToApprove.sub_category : ''} has been approved.`,
      });

      setCostToApprove(null);
      onRefresh();
    } catch (err) {
      console.error('Error approving cost:', err);
      toast({
        title: 'Error',
        description: 'Failed to approve cost entry.',
        variant: 'destructive',
      });
    } finally {
      setIsApproving(false);
    }
  };

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    const symbol = currency === 'USD' ? '$' : 'R';
    return `${symbol}${amount.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-ZA');
  };

  const getStatusBadge = (cost: CostEntry) => {
    if (cost.is_flagged && cost.investigation_status !== 'resolved') {
      return (
        <Badge variant="destructive">
          <AlertTriangle className="w-3 h-3 mr-1" />
          Flagged
        </Badge>
      );
    }

    if (cost.investigation_status === 'resolved') {
      return (
        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
          <CheckCircle className="w-3 h-3 mr-1" />
          Verified
        </Badge>
      );
    }

    // Unflagged but not yet explicitly approved
    return (
      <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
        <AlertTriangle className="w-3 h-3 mr-1" />
        Pending Verification
      </Badge>
    );
  };

  if (showCostForm) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{selectedCost ? 'Edit Cost' : 'Add Cost'}</CardTitle>
        </CardHeader>
        <CardContent>
          <CostForm
            tripId={tripId}
            cost={selectedCost || undefined}
            onSubmit={(success) => {
              if (success) {
                setShowCostForm(false);
                setSelectedCost(null);
                onRefresh();
              }
            }}
            onCancel={() => {
              setShowCostForm(false);
              setSelectedCost(null);
            }}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Route Pre-defined Expenses Suggestor */}
      {route && (
        <RouteExpensesSuggestor
          tripId={tripId}
          route={route}
          existingCosts={costs.map((c) => ({ category: c.category, sub_category: c.sub_category }))}
          onExpensesAdded={onRefresh}
        />
      )}

      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Cost Entries</h3>
        <Button onClick={() => setShowCostForm(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Cost
        </Button>
      </div>

      {costs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">No costs added yet</p>
            <Button onClick={() => setShowCostForm(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add First Cost
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {costs.map((cost) => (
            <Card key={cost.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-medium">{cost.category}</h4>
                      {cost.sub_category && (
                        <span className="text-sm text-muted-foreground">
                          • {cost.sub_category}
                        </span>
                      )}
                      {getStatusBadge(cost)}
                    </div>

                    <div className="grid grid-cols-3 gap-4 text-sm mb-3">
                      <div>
                        <p className="text-muted-foreground">Amount</p>
                        <p className="font-medium">{formatCurrency(cost.amount, cost.currency)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Date</p>
                        <p className="font-medium">{formatDate(cost.date)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Reference</p>
                        <p className="font-medium">{cost.reference_number || 'N/A'}</p>
                      </div>
                    </div>

                    {cost.is_flagged && cost.flag_reason && (
                      <div className="p-2 bg-amber-50 border border-amber-200 rounded mb-3">
                        <p className="text-sm font-medium text-amber-800">Flag Reason:</p>
                        <p className="text-sm text-amber-700">{cost.flag_reason}</p>
                      </div>
                    )}

                    {cost.notes && (
                      <p className="text-sm text-muted-foreground mb-3">{cost.notes}</p>
                    )}

                    {cost.attachments && cost.attachments.length > 0 && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <FileText className="w-4 h-4" />
                        <span>{cost.attachments.length} attachment(s)</span>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 ml-4">
                    {!cost.is_flagged && cost.investigation_status !== 'resolved' && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-emerald-600 border-emerald-300 hover:bg-emerald-50"
                        onClick={() => setCostToApprove(cost)}
                      >
                        <ShieldCheck className="w-3 h-3 mr-1" />
                        Verify
                      </Button>
                    )}
                    {cost.is_flagged && cost.investigation_status !== 'resolved' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onResolveFlag(cost)}
                      >
                        <Edit className="w-3 h-3 mr-1" />
                        Resolve
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedCost(cost);
                        setShowCostForm(true);
                      }}
                    >
                      <Edit className="w-3 h-3 mr-1" />
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => setCostToDelete(cost)}
                    >
                      <Trash2 className="w-3 h-3 mr-1" />
                      Delete
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={!!costToDelete} onOpenChange={() => setCostToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Cost Entry</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this cost entry? This action cannot be undone.
              {costToDelete?.is_flagged && (
                <span className="block mt-2 text-amber-600 font-medium">
                  Warning: This cost entry is flagged and under investigation.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Approve Cost Confirmation Dialog */}
      <AlertDialog open={!!costToApprove} onOpenChange={() => setCostToApprove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              Approve Cost
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>Are you sure you want to approve this cost entry?</p>
                {costToApprove && (
                  <div className="rounded-lg border bg-muted/50 p-3 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Category</span>
                      <span className="font-medium">{costToApprove.category}{costToApprove.sub_category ? ` – ${costToApprove.sub_category}` : ''}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Amount</span>
                      <span className="font-medium">{formatCurrency(costToApprove.amount, costToApprove.currency || 'USD')}</span>
                    </div>
                    {costToApprove.flag_reason && (
                      <div className="pt-2 border-t">
                        <span className="text-muted-foreground">Flag Reason</span>
                        <p className="mt-1 text-amber-700 font-medium">{costToApprove.flag_reason}</p>
                      </div>
                    )}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">This will mark the cost as verified and approved.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isApproving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleApproveCost}
              disabled={isApproving}
              className="bg-emerald-600 text-white hover:bg-emerald-700"
            >
              {isApproving ? 'Approving...' : 'Approve Cost'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default TripCostManager;
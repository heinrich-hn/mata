import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { ClientSelect } from '@/components/ui/client-select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Modal from '@/components/ui/modal';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { IMPACT_LEVELS, MISSED_LOAD_REASONS } from '@/constants/customerRetention';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { MissedLoad } from '@/types/operations';
import
  {
    AlertTriangle,
    CheckCircle,
    DollarSign,
    Edit,
    FileText,
    Plus,
    Save,
    Trash2,
    TrendingDown,
    X
  } from 'lucide-react';
import { useState } from 'react';
import { DatePicker } from '../ui/date-picker';

interface MissedLoadsTrackerProps {
  missedLoads: MissedLoad[];
  onAddMissedLoad: (missedLoad: Omit<MissedLoad, 'id'>) => void;
  onUpdateMissedLoad: (missedLoad: MissedLoad) => void;
  onDeleteMissedLoad?: (id: string) => void;
}

const MissedLoadsTracker = ({
  missedLoads,
  onAddMissedLoad,
  onUpdateMissedLoad,
  onDeleteMissedLoad
}: MissedLoadsTrackerProps) => {
  const { userName } = useAuth();
  const { toast } = useToast();
  const [showModal, setShowModal] = useState(false);
  const [showResolutionModal, setShowResolutionModal] = useState(false);
  const [editingLoad, setEditingLoad] = useState<MissedLoad | null>(null);
  const [resolvingLoad, setResolvingLoad] = useState<MissedLoad | null>(null);

  const [formData, setFormData] = useState({
    customer_name: undefined as string | undefined,
    load_request_date: new Date().toISOString().split('T')[0],
    requested_pickup_date: '',
    requested_delivery_date: '',
    route: '',
    estimated_revenue: '',
    currency: 'USD',
    reason: '',
    reason_description: '',
    resolution_status: 'pending',
    follow_up_required: true,
    competitor_won: false,
    impact: 'medium'
  });

  const [resolutionData, setResolutionData] = useState({
    resolution_notes: '',
    compensation_offered: '',
    compensation_notes: ''
  });

  const handleChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleResolutionChange = (field: string, value: string) => {
    setResolutionData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = () => {
    if (!formData.customer_name || !formData.route || !formData.estimated_revenue || !formData.reason) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields',
        variant: 'destructive'
      });
      return;
    }

    const missedLoadData: Omit<MissedLoad, 'id'> = {
      customer_name: formData.customer_name,
      load_request_date: formData.load_request_date,
      requested_pickup_date: formData.requested_pickup_date,
      requested_delivery_date: formData.requested_delivery_date,
      route: formData.route,
      estimated_revenue: Number(formData.estimated_revenue),
      currency: formData.currency,
      reason: formData.reason,
      reason_description: formData.reason_description || undefined,
      resolution_status: formData.resolution_status as 'pending' | 'resolved' | 'lost_opportunity' | 'rescheduled',
      follow_up_required: formData.follow_up_required,
      competitor_won: formData.competitor_won,
      recorded_by: userName || 'Unknown User',
      recorded_at: new Date().toISOString(),
      impact: formData.impact as 'low' | 'medium' | 'high'
    };

    if (editingLoad) {
      onUpdateMissedLoad({ ...missedLoadData, id: editingLoad.id });
      toast({
        title: 'Success',
        description: 'Missed load updated successfully'
      });
    } else {
      onAddMissedLoad(missedLoadData);
      toast({
        title: 'Success',
        description: 'Missed load recorded successfully'
      });
    }

    handleClose();
  };

  const handleResolutionSubmit = () => {
    if (!resolutionData.resolution_notes || !resolvingLoad) {
      toast({
        title: 'Validation Error',
        description: 'Please provide resolution notes',
        variant: 'destructive'
      });
      return;
    }

    const updatedLoad: MissedLoad = {
      ...resolvingLoad,
      resolution_status: 'resolved',
      resolution_notes: resolutionData.resolution_notes,
      resolved_at: new Date().toISOString(),
      resolved_by: userName || 'Unknown User',
      compensation_offered: resolutionData.compensation_offered ? Number(resolutionData.compensation_offered) : undefined,
      compensation_notes: resolutionData.compensation_notes || undefined
    };

    onUpdateMissedLoad(updatedLoad);

    toast({
      title: 'Success',
      description: 'Missed load resolved successfully'
    });

    setShowResolutionModal(false);
    setResolvingLoad(null);
    setResolutionData({
      resolution_notes: '',
      compensation_offered: '',
      compensation_notes: ''
    });
  };

  const handleEdit = (load: MissedLoad) => {
    setFormData({
      customer_name: load.customer_name || undefined,
      load_request_date: load.load_request_date || '',
      requested_pickup_date: load.requested_pickup_date || '',
      requested_delivery_date: load.requested_delivery_date || '',
      route: load.route || '',
      estimated_revenue: load.estimated_revenue?.toString() || '',
      currency: load.currency || 'USD',
      reason: load.reason,
      reason_description: load.reason_description || '',
      resolution_status: load.resolution_status || 'pending',
      follow_up_required: load.follow_up_required || true,
      competitor_won: load.competitor_won || false,
      impact: load.impact || 'medium'
    });
    setEditingLoad(load);
    setShowModal(true);
  };

  const handleResolve = (load: MissedLoad) => {
    setResolvingLoad(load);
    setResolutionData({
      resolution_notes: '',
      compensation_offered: '',
      compensation_notes: ''
    });
    setShowResolutionModal(true);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to delete this missed load?')) {
      onDeleteMissedLoad?.(id);
    }
  };

  const handleClose = () => {
    setShowModal(false);
    setEditingLoad(null);
    setFormData({
      customer_name: undefined,
      load_request_date: new Date().toISOString().split('T')[0],
      requested_pickup_date: '',
      requested_delivery_date: '',
      route: '',
      estimated_revenue: '',
      currency: 'USD',
      reason: '',
      reason_description: '',
      resolution_status: 'pending',
      follow_up_required: true,
      competitor_won: false,
      impact: 'medium'
    });
  };

  // Calculate summary metrics
  const totalMissedLoads = missedLoads.length;
  const revenueLost = missedLoads
    .filter(load => load.currency === 'USD' && load.resolution_status !== 'resolved')
    .reduce((sum, load) => sum + (load.estimated_revenue || 0), 0);
  const revenueLostUSD = missedLoads
    .filter(load => load.currency === 'USD' && load.resolution_status !== 'resolved')
    .reduce((sum, load) => sum + (load.estimated_revenue || 0), 0);
  const resolvedLoads = missedLoads.filter(load => load.resolution_status === 'resolved').length;
  const competitorWins = missedLoads.filter(load => load.competitor_won).length;

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'resolved': return 'bg-emerald-500/10 text-emerald-700';
      case 'rescheduled': return 'bg-primary/10 text-primary';
      case 'lost_opportunity': return 'bg-destructive/10 text-destructive';
      default: return 'bg-amber-500/10 text-amber-700';
    }
  };

  const getImpactColor = (impact?: string) => {
    switch (impact) {
      case 'high': return 'bg-destructive/10 text-destructive';
      case 'medium': return 'bg-amber-500/10 text-amber-700';
      default: return 'bg-emerald-500/10 text-emerald-700';
    }
  };

  return (
    <div className="space-y-5">
      {/* Glass Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-card/80 backdrop-blur-sm border border-border/60 rounded-xl px-5 py-3.5 shadow-sm">
        <span className="text-sm text-muted-foreground">Track and analyze missed business opportunities</span>
        <Button size="sm" onClick={() => setShowModal(true)} className="h-9 gap-2 text-sm">
          <Plus className="w-4 h-4" />
          Record Missed Load
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Missed Loads</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{totalMissedLoads}</div>
            <p className="text-xs text-muted-foreground mt-1">{resolvedLoads} resolved</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Revenue Lost</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{formatCurrency(revenueLost)}</div>
            <p className="text-xs text-muted-foreground mt-1">{formatCurrency(revenueLostUSD, 'USD')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Resolved</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{resolvedLoads}</div>
            <p className="text-xs text-muted-foreground mt-1">Successfully handled</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Competitor Wins</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{competitorWins}</div>
            <p className="text-xs text-muted-foreground mt-1">High priority</p>
          </CardContent>
        </Card>
      </div>

      {/* Missed Loads List */}
      <div className="bg-card/80 backdrop-blur-sm border border-border/60 rounded-xl shadow-sm">
        <div className="px-5 py-4 border-b border-border/60">
          <span className="font-semibold">Missed Loads ({missedLoads.length})</span>
        </div>
        <div className="p-5">
          {missedLoads.length === 0 ? (
            <div className="text-center py-12">
              <TrendingDown className="mx-auto h-10 w-10 text-muted-foreground" />
              <h3 className="mt-2 text-sm font-medium">No missed loads recorded</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Start tracking missed business opportunities.
              </p>
              <div className="mt-6">
                <Button size="sm" onClick={() => setShowModal(true)} className="h-9 gap-2 text-sm">
                  <Plus className="w-4 h-4" />
                  Record First Missed Load
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {missedLoads.map((load) => (
                <div key={load.id} className="border border-border/50 rounded-xl p-4 hover:bg-accent/50 transition-colors">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="text-sm font-semibold">{load.customer_name || load.client_name}</h3>
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(load.resolution_status)}`}>
                          {(load.resolution_status || 'pending').replace('_', ' ').toUpperCase()}
                        </span>
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getImpactColor(load.impact)}`}>
                          {(load.impact || 'medium').toUpperCase()} IMPACT
                        </span>
                        {load.competitor_won && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-destructive/10 text-destructive">
                            COMPETITOR WON
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-3">
                        <div>
                          <p className="text-sm text-muted-foreground">Route</p>
                          <p className="font-medium">{load.route}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Estimated Revenue</p>
                          <p className="font-medium text-destructive">
                            {formatCurrency(load.estimated_revenue || 0, (load.currency || 'USD') as string)}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Reason</p>
                          <p className="font-medium text-sm">
                            {MISSED_LOAD_REASONS.find(r => r.value === load.reason)?.label || load.reason}
                          </p>
                        </div>
                      </div>

                      {load.resolution_status === 'resolved' && load.resolution_notes && (
                        <div className="mb-3 p-3 bg-emerald-500/5 border border-emerald-300/30 rounded-xl">
                          <p className="text-sm font-medium">Resolution Notes:</p>
                          <p className="text-sm text-muted-foreground">{load.resolution_notes}</p>
                        </div>
                      )}

                      <div className="text-xs text-muted-foreground">
                        Recorded on {load.recorded_at ? formatDate(load.recorded_at) : 'Unknown'}
                      </div>
                    </div>

                    <div className="flex space-x-2 ml-4">
                      {load.resolution_status !== 'resolved' && (
                        <Button
                          size="sm"
                          onClick={() => handleResolve(load)}
                        >
                          <FileText className="w-3 h-3 mr-1" />
                          Resolve
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEdit(load)}
                      >
                        <Edit className="w-3 h-3 mr-1" />
                        Edit
                      </Button>
                      {onDeleteMissedLoad && (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDelete(load.id)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={handleClose}
        title={editingLoad ? 'Edit Missed Load' : 'Record Missed Load'}
        maxWidth="lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Customer Name *</Label>
              <ClientSelect
                value={formData.customer_name}
                onValueChange={(value) => handleChange('customer_name', value)}
                placeholder="Select or create customer"
              />
            </div>

            <div className="space-y-2">
              <Label>Load Request Date *</Label>
              <DatePicker
                value={formData.load_request_date}
                onChange={(date) => handleChange('load_request_date', date ? date.toISOString().split('T')[0] : '')}
                placeholder="Select request date"
              />
            </div>

            <div className="space-y-2">
              <Label>Requested Pickup Date *</Label>
              <DatePicker
                value={formData.requested_pickup_date}
                onChange={(date) => handleChange('requested_pickup_date', date ? date.toISOString().split('T')[0] : '')}
                placeholder="Select pickup date"
              />
            </div>

            <div className="space-y-2">
              <Label>Requested Delivery Date *</Label>
              <DatePicker
                value={formData.requested_delivery_date}
                onChange={(date) => handleChange('requested_delivery_date', date ? date.toISOString().split('T')[0] : '')}
                placeholder="Select delivery date"
              />
            </div>

            <div className="space-y-2">
              <Label>Route *</Label>
              <Input
                value={formData.route}
                onChange={(e) => handleChange('route', e.target.value)}
                placeholder="e.g., Johannesburg to Cape Town"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label>Currency *</Label>
                <Select value={formData.currency} onValueChange={(value) => handleChange('currency', value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD ($)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Estimated Revenue *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.estimated_revenue}
                  onChange={(e) => handleChange('estimated_revenue', e.target.value)}
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Reason *</Label>
              <Select value={formData.reason} onValueChange={(value) => handleChange('reason', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select reason" />
                </SelectTrigger>
                <SelectContent>
                  {MISSED_LOAD_REASONS.map(reason => (
                    <SelectItem key={reason.value} value={reason.value}>
                      {reason.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Impact Level</Label>
              <Select value={formData.impact} onValueChange={(value) => handleChange('impact', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {IMPACT_LEVELS.map(level => (
                    <SelectItem key={level.value} value={level.value}>
                      {level.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Additional Details</Label>
            <Textarea
              value={formData.reason_description}
              onChange={(e) => handleChange('reason_description', e.target.value)}
              placeholder="Provide additional context..."
              rows={3}
            />
          </div>

          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="follow_up"
                checked={formData.follow_up_required}
                onCheckedChange={(checked) => handleChange('follow_up_required', !!checked)}
              />
              <Label htmlFor="follow_up" className="cursor-pointer">Follow-up required</Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="competitor"
                checked={formData.competitor_won}
                onCheckedChange={(checked) => handleChange('competitor_won', !!checked)}
              />
              <Label htmlFor="competitor" className="cursor-pointer">Competitor won</Label>
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t">
            <Button variant="outline" onClick={handleClose}>
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
            <Button onClick={handleSubmit}>
              <Save className="w-4 h-4 mr-2" />
              {editingLoad ? 'Update' : 'Record'} Missed Load
            </Button>
          </div>
        </div>
      </Modal>

      {/* Resolution Modal */}
      <Modal
        isOpen={showResolutionModal}
        onClose={() => {
          setShowResolutionModal(false);
          setResolvingLoad(null);
          setResolutionData({
            resolution_notes: '',
            compensation_offered: '',
            compensation_notes: ''
          });
        }}
        title="Resolve Missed Load"
        maxWidth="md"
      >
        {resolvingLoad && (
          <div className="space-y-4">
            <div className="bg-muted/40 border border-border/40 rounded-xl p-4">
              <h4 className="text-sm font-medium mb-2">Missed Load Details</h4>
              <div className="text-sm text-muted-foreground space-y-1">
                <p><strong>Customer:</strong> {resolvingLoad.customer_name || resolvingLoad.client_name}</p>
                <p><strong>Route:</strong> {resolvingLoad.route}</p>
                <p><strong>Estimated Revenue:</strong> {formatCurrency(resolvingLoad.estimated_revenue || 0, (resolvingLoad.currency || 'USD') as string)}</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Resolution Notes *</Label>
              <Textarea
                value={resolutionData.resolution_notes}
                onChange={(e) => handleResolutionChange('resolution_notes', e.target.value)}
                placeholder="Describe how this was resolved..."
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <Label>Compensation Offered</Label>
              <Input
                type="number"
                step="0.01"
                value={resolutionData.compensation_offered}
                onChange={(e) => handleResolutionChange('compensation_offered', e.target.value)}
                placeholder="0.00"
              />
            </div>

            <div className="space-y-2">
              <Label>Compensation Notes</Label>
              <Textarea
                value={resolutionData.compensation_notes}
                onChange={(e) => handleResolutionChange('compensation_notes', e.target.value)}
                placeholder="Details about compensation..."
                rows={2}
              />
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => {
                  setShowResolutionModal(false);
                  setResolvingLoad(null);
                }}
              >
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
              <Button onClick={handleResolutionSubmit}>
                <CheckCircle className="w-4 h-4 mr-2" />
                Resolve
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default MissedLoadsTracker;
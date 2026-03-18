import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileUpload } from '@/components/ui/file-upload';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ADDITIONAL_COST_TYPES } from '@/constants/costCategories';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { formatCurrency } from '@/lib/formatters';
import { DollarSign, Download, Eye, Loader2, Plus, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';

type AdditionalCost = Database['public']['Tables']['trip_additional_costs']['Row'];

interface SupportingDocument {
  id: string;
  filename: string;
  file_url: string;
}

interface AdditionalCostWithDocuments extends AdditionalCost {
  supporting_documents?: SupportingDocument[];
}

interface AdditionalCostsFormProps {
  tripId: string;
  readOnly?: boolean;
  onCostsUpdate?: () => void;
}

export const AdditionalCostsForm = ({
  tripId,
  readOnly = false,
  onCostsUpdate
}: AdditionalCostsFormProps) => {
  const { userName } = useAuth();
  const { toast } = useToast();
  const [additionalCosts, setAdditionalCosts] = useState<AdditionalCostWithDocuments[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    costType: '',
    amount: '',
    currency: 'ZAR',
    notes: ''
  });
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const fetchAdditionalCosts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('trip_additional_costs')
        .select(`
          *,
          supporting_documents:additional_cost_documents(*)
        `)
        .eq('trip_id', tripId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAdditionalCosts(data || []);
    } catch (err) {
      console.error('Error fetching additional costs:', err);
      toast({
        title: 'Error',
        description: 'Failed to load additional costs',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const uploadFiles = async (files: FileList, costId: string): Promise<void> => {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileExt = file.name.split('.').pop();
      const fileName = `${costId}_${Date.now()}_${i}.${fileExt}`;
      const filePath = `additional-costs/${tripId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('trip-documents')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('trip-documents')
        .getPublicUrl(filePath);

      const { error: dbError } = await supabase
        .from('additional_cost_documents')
        .insert({
          additional_cost_id: costId,
          filename: file.name,
          file_path: filePath,
          file_url: publicUrl,
          file_size: file.size,
          file_type: file.type,
          uploaded_by: userName || 'Unknown User',
        });

      if (dbError) throw dbError;
    }
  };

  const handleAddCost = async () => {
    if (!validateForm()) return;

    try {
      setSubmitting(true);

      const { data: costData, error: costError } = await supabase
        .from('trip_additional_costs')
        .insert({
          trip_id: tripId,
          cost_type: formData.costType,
          amount: Number(formData.amount),
          currency: formData.currency,
          notes: formData.notes,
          added_by: userName || 'Unknown User',
        })
        .select()
        .single();

      if (costError) throw costError;

      if (selectedFiles && selectedFiles.length > 0) {
        await uploadFiles(selectedFiles, costData.id);
      }

      setFormData({
        costType: '',
        amount: '',
        currency: 'ZAR',
        notes: ''
      });
      setSelectedFiles(null);
      setShowForm(false);

      await fetchAdditionalCosts();
      onCostsUpdate?.();

      toast({
        title: 'Success',
        description: 'Additional cost added successfully',
      });
    } catch (err) {
      console.error('Error adding additional cost:', err);
      toast({
        title: 'Error',
        description: 'Failed to add additional cost',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveCost = async (costId: string) => {
    if (!confirm('Are you sure you want to delete this additional cost?')) return;

    try {
      const { error } = await supabase
        .from('trip_additional_costs')
        .delete()
        .eq('id', costId);

      if (error) throw error;

      await fetchAdditionalCosts();
      onCostsUpdate?.();

      toast({
        title: 'Success',
        description: 'Additional cost deleted successfully',
      });
    } catch (err) {
      console.error('Error removing additional cost:', err);
      toast({
        title: 'Error',
        description: 'Failed to remove additional cost',
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    fetchAdditionalCosts();

    const subscription = supabase
      .channel(`additional-costs-${tripId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'trip_additional_costs', filter: `trip_id=eq.${tripId}` },
        () => void fetchAdditionalCosts()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId]);  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.costType) newErrors.costType = 'Cost type is required';
    if (!formData.amount) newErrors.amount = 'Amount is required';
    if (formData.amount && (isNaN(Number(formData.amount)) || Number(formData.amount) <= 0)) {
      newErrors.amount = 'Amount must be a valid number greater than 0';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const getTotalAdditionalCosts = (currency: 'USD' | 'ZAR') => {
    return additionalCosts
      .filter(cost => cost.currency === currency)
      .reduce((sum, cost) => sum + cost.amount, 0);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
        <span className="ml-2">Loading additional costs...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <DollarSign className="w-5 h-5 text-success" />
              <CardTitle>Additional Costs Summary</CardTitle>
            </div>
            {!readOnly && (
              <Button size="sm" onClick={() => setShowForm(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add Cost
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-success/10 rounded-lg">
              <p className="text-sm text-muted-foreground">ZAR Additional Costs</p>
              <p className="text-xl font-bold text-success">
                {formatCurrency(getTotalAdditionalCosts('ZAR'), 'ZAR')}
              </p>
              <p className="text-xs text-muted-foreground">
                {additionalCosts.filter(c => c.currency === 'ZAR').length} entries
              </p>
            </div>
            <div className="text-center p-4 bg-info/10 rounded-lg">
              <p className="text-sm text-muted-foreground">USD Additional Costs</p>
              <p className="text-xl font-bold text-info">
                {formatCurrency(getTotalAdditionalCosts('USD'), 'USD')}
              </p>
              <p className="text-xs text-muted-foreground">
                {additionalCosts.filter(c => c.currency === 'USD').length} entries
              </p>
            </div>
            <div className="text-center p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">Total Entries</p>
              <p className="text-xl font-bold">
                {additionalCosts.length}
              </p>
              <p className="text-xs text-muted-foreground">additional costs</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>Add Additional Cost</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="costType">Cost Type</Label>
                <Select value={formData.costType} onValueChange={(val) => handleChange('costType', val)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select cost type..." />
                  </SelectTrigger>
                  <SelectContent>
                    {ADDITIONAL_COST_TYPES.map(type => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.costType && <p className="text-sm text-destructive">{errors.costType}</p>}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="amount">Amount</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) => handleChange('amount', e.target.value)}
                  />
                  {errors.amount && <p className="text-sm text-destructive">{errors.amount}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="currency">Currency</Label>
                  <Select value={formData.currency} onValueChange={(val) => handleChange('currency', val)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ZAR">ZAR (R)</SelectItem>
                      <SelectItem value="USD">USD ($)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => handleChange('notes', e.target.value)}
                  placeholder="Optional notes about this additional cost..."
                />
              </div>

              <FileUpload
                label="Supporting Documents"
                onChange={(files) => setSelectedFiles(files)}
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                multiple
              />

              <div className="flex justify-end space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowForm(false)}
                  disabled={submitting}
                >
                  <X className="w-4 h-4 mr-2" />
                  Cancel
                </Button>
                <Button
                  onClick={handleAddCost}
                  disabled={submitting}
                >
                  {submitting ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4 mr-2" />
                  )}
                  {submitting ? 'Adding...' : 'Add Cost'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {additionalCosts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Additional Costs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {additionalCosts.map((cost) => (
                <div key={cost.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h4 className="font-medium">{cost.cost_type}</h4>
                          <p className="text-sm text-muted-foreground">
                            Added on {new Date(cost.created_at).toLocaleDateString()} by {cost.added_by}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-lg">
                            {formatCurrency(cost.amount, cost.currency as 'ZAR' | 'USD')}
                          </p>
                        </div>
                      </div>

                      {cost.notes && (
                        <p className="text-sm text-muted-foreground mb-3">{cost.notes}</p>
                      )}

                      {cost.supporting_documents && cost.supporting_documents.length > 0 && (
                        <div className="mb-3">
                          <p className="text-sm font-medium mb-2">Supporting Documents:</p>
                          <div className="flex flex-wrap gap-2">
                            {cost.supporting_documents.map((doc) => (
                              <div key={doc.id} className="flex items-center space-x-2 bg-muted px-2 py-1 rounded text-sm">
                                <span className="text-muted-foreground">{doc.filename}</span>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => window.open(doc.file_url, '_blank')}
                                >
                                  <Eye className="w-3 h-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    const link = document.createElement('a');
                                    link.href = doc.file_url;
                                    link.download = doc.filename;
                                    document.body.appendChild(link);
                                    link.click();
                                    // Remove link safely
                                    setTimeout(() => {
                                      if (document.body.contains(link)) {
                                        document.body.removeChild(link);
                                      }
                                    }, 100);
                                  }}
                                >
                                  <Download className="w-3 h-3" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {!readOnly && (
                      <div className="ml-4">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRemoveCost(cost.id)}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
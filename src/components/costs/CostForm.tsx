import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { DatePicker } from '@/components/ui/date-picker';
import { FileUpload } from '@/components/ui/file-upload';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { COST_CATEGORIES } from '@/constants/costCategories';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Cost } from '@/types/forms';
import { Flag, Loader2, Save, X } from 'lucide-react';
import { useEffect, useState } from 'react';

interface CostFormProps {
  tripId: string;
  cost?: Cost;
  onSubmit: (success: boolean) => void;
  onCancel: () => void;
}

export const CostForm = ({ tripId, cost, onSubmit, onCancel }: CostFormProps) => {
  const { userName } = useAuth();
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    category: '',
    subCategory: '',
    amount: '',
    currency: 'USD',
    referenceNumber: '',
    date: new Date().toISOString().split('T')[0],
    notes: '',
    isFlagged: false,
    flagReason: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [availableSubCategories, setAvailableSubCategories] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (cost) {
      setFormData({
        category: cost.category || '',
        subCategory: cost.sub_category || '',
        amount: cost.amount?.toString() || '',
        currency: cost.currency || 'USD',
        referenceNumber: cost.reference_number || '',
        date: cost.date || '',
        notes: cost.notes || '',
        isFlagged: cost.is_flagged || false,
        flagReason: cost.flag_reason || '',
      });

      if (cost.category && COST_CATEGORIES[cost.category as keyof typeof COST_CATEGORIES]) {
        setAvailableSubCategories([...COST_CATEGORIES[cost.category as keyof typeof COST_CATEGORIES]]);
      }
    }
  }, [cost]);

  const handleChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));

    if (field === 'category' && typeof value === 'string') {
      const subCategories = COST_CATEGORIES[value as keyof typeof COST_CATEGORIES] || [];
      setAvailableSubCategories([...subCategories]);
      setFormData(prev => ({ ...prev, subCategory: '' }));
    }

    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.category) newErrors.category = 'Cost category is required';
    if (!formData.subCategory) newErrors.subCategory = 'Sub-cost type is required';
    if (!formData.amount) newErrors.amount = 'Amount is required';
    if (formData.amount && (isNaN(Number(formData.amount)) || Number(formData.amount) <= 0)) {
      newErrors.amount = 'Amount must be a valid number greater than 0';
    }
    if (!formData.referenceNumber) newErrors.referenceNumber = 'Reference number is required';
    if (!formData.date) newErrors.date = 'Date is required';
    if (formData.isFlagged && !formData.flagReason.trim()) {
      newErrors.flagReason = 'Flag reason is required when manually flagging a cost entry';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const uploadFiles = async (files: FileList, costId: string): Promise<void> => {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileExt = file.name.split('.').pop();
      const fileName = `${costId}_${Date.now()}_${i}.${fileExt}`;
      const filePath = `trip-costs/${tripId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('trip-documents')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('trip-documents')
        .getPublicUrl(filePath);

      const { error: dbError } = await supabase
        .from('cost_attachments')
        .insert({
          cost_id: costId,
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      setSubmitting(true);

      const highRiskCategories = ['Non-Value-Added Costs', 'Border Costs'];
      const isHighRisk = highRiskCategories.includes(formData.category);
      const shouldFlag = formData.isFlagged || isHighRisk;

      let flagReason = '';
      if (formData.isFlagged && formData.flagReason.trim()) {
        flagReason = formData.flagReason.trim();
      } else if (isHighRisk) {
        flagReason = `High-risk category: ${formData.category} - ${formData.subCategory} requires review`;
      }

      const costData = {
        trip_id: tripId,
        category: formData.category,
        sub_category: formData.subCategory,
        amount: Number(formData.amount),
        currency: formData.currency,
        reference_number: formData.referenceNumber.trim(),
        date: formData.date,
        notes: formData.notes.trim() || null,
        is_flagged: shouldFlag,
        flag_reason: flagReason || null,
        is_system_generated: false,
      };

      if (cost) {
        const { error: updateError } = await supabase
          .from('cost_entries')
          .update(costData)
          .eq('id', cost.id);

        if (updateError) throw updateError;

        if (selectedFiles && selectedFiles.length > 0) {
          await uploadFiles(selectedFiles, cost.id);
        }
      } else {
        const { data: newCost, error: insertError } = await supabase
          .from('cost_entries')
          .insert(costData)
          .select()
          .single();

        if (insertError) throw insertError;

        // Auto-resolve any active "no costs" alert for this trip
        if (tripId) {
          supabase
            .from('alerts')
            .update({
              status: 'resolved',
              resolved_at: new Date().toISOString(),
              resolution_comment: 'Cost entry added',
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

        if (selectedFiles && selectedFiles.length > 0) {
          await uploadFiles(selectedFiles, newCost.id);
        }
      }

      toast({
        title: 'Success',
        description: `Cost entry ${cost ? 'updated' : 'added'} successfully`,
      });
      onSubmit(true);
    } catch (err) {
      console.error('Error saving cost:', err);
      toast({
        title: 'Error',
        description: 'Failed to save cost entry',
        variant: 'destructive',
      });
      onSubmit(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="category">Cost Category</Label>
          <Select value={formData.category} onValueChange={(val) => handleChange('category', val)}>
            <SelectTrigger>
              <SelectValue placeholder="Select category..." />
            </SelectTrigger>
            <SelectContent>
              {Object.keys(COST_CATEGORIES).map(key => (
                <SelectItem key={key} value={key}>{key}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.category && <p className="text-sm text-destructive">{errors.category}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="subCategory">Sub-category</Label>
          <Select value={formData.subCategory} onValueChange={(val) => handleChange('subCategory', val)} disabled={!formData.category}>
            <SelectTrigger>
              <SelectValue placeholder="Select sub-category..." />
            </SelectTrigger>
            <SelectContent>
              {availableSubCategories.map(sub => (
                <SelectItem key={sub} value={sub}>{sub}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.subCategory && <p className="text-sm text-destructive">{errors.subCategory}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
              <SelectItem value="USD">USD ($)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="date">Date</Label>
          <DatePicker
            value={formData.date}
            onChange={(date) => {
              if (date) {
                // Format as local date (YYYY-MM-DD) to avoid timezone issues
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                handleChange('date', `${year}-${month}-${day}`);
              } else {
                handleChange('date', '');
              }
            }}
            placeholder="Select date"
          />
          {errors.date && <p className="text-sm text-destructive">{errors.date}</p>}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="referenceNumber">Reference Number</Label>
        <Input
          value={formData.referenceNumber}
          onChange={(e) => handleChange('referenceNumber', e.target.value)}
          placeholder="Invoice/receipt number"
        />
        {errors.referenceNumber && <p className="text-sm text-destructive">{errors.referenceNumber}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          value={formData.notes}
          onChange={(e) => handleChange('notes', e.target.value)}
          placeholder="Additional notes about this cost..."
        />
      </div>

      <div className="border rounded-lg p-4 space-y-3">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="manual-flag"
            checked={formData.isFlagged}
            onCheckedChange={(checked) => handleChange('isFlagged', checked as boolean)}
          />
          <Label htmlFor="manual-flag" className="flex items-center cursor-pointer">
            <Flag className="w-4 h-4 mr-1" />
            Manually flag this cost for investigation
          </Label>
        </div>

        {formData.isFlagged && (
          <div className="space-y-2">
            <Label htmlFor="flagReason">Flag Reason</Label>
            <Textarea
              value={formData.flagReason}
              onChange={(e) => handleChange('flagReason', e.target.value)}
              placeholder="Reason for flagging this cost..."
            />
            {errors.flagReason && <p className="text-sm text-destructive">{errors.flagReason}</p>}
          </div>
        )}
      </div>

      <FileUpload
        label="Attachments"
        onChange={(files) => setSelectedFiles(files)}
        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
        multiple
      />

      <div className="flex justify-end space-x-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
          <X className="w-4 h-4 mr-2" />
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          {submitting ? 'Saving...' : 'Save Cost'}
        </Button>
      </div>
    </form>
  );
};
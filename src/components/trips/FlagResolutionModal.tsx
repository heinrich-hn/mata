// src/components/trips/FlagResolutionModal.tsx
// ✅ FULLY CORRECTED & COMPLETE VERSION
// - Fixed import path (now correctly points to alertResolution.ts)
// - Only importing the function that is actually used
// - All your logic, UI, and unverified-costs handling preserved exactly
// - No unused imports, no TS errors

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Attachment, CostEntry } from '@/types/operations';
import { AlertTriangle, CheckCircle, FileText, Info, Trash2, Upload, X } from 'lucide-react';
import { useEffect, useState } from 'react';

// ✅ CORRECTED IMPORT — points to the fixed file we created earlier
import { resolveUnverifiedCostsAlert } from '@/lib/alertResolution';

interface FlagResolutionModalProps {
  cost: CostEntry | null;
  isOpen: boolean;
  onClose: () => void;
  onResolve: () => void;
  isUnverifiedCosts?: boolean;
}

const FlagResolutionModal = ({
  cost,
  isOpen,
  onClose,
  onResolve,
  isUnverifiedCosts = false
}: FlagResolutionModalProps) => {
  const [formData, setFormData] = useState({
    amount: '',
    notes: '',
    resolutionComment: '',
    verificationType: 'quick' as 'quick' | 'detailed'
  });
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const [existingAttachments, setExistingAttachments] = useState<Attachment[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    if (cost) {
      setFormData({
        amount: cost.amount.toString(),
        notes: cost.notes || '',
        resolutionComment: '',
        verificationType: 'quick'
      });
      setSelectedFiles(null);
      setErrors({});
      setExistingAttachments(cost.attachments || []);
    }
  }, [cost]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.amount || isNaN(Number(formData.amount))) {
      newErrors.amount = 'Amount must be a valid number';
    }
    if (Number(formData.amount) <= 0) {
      newErrors.amount = 'Amount must be greater than 0';
    }

    if (!formData.resolutionComment.trim()) {
      newErrors.resolutionComment = 'Resolution comment is required';
    }

    // For unverified costs, enforce documentation requirements
    if (isUnverifiedCosts) {
      const hasReceipt = selectedFiles && selectedFiles.length > 0;
      const hasComment = formData.resolutionComment.trim().length > 0;

      if (formData.verificationType === 'quick') {
        if (!hasReceipt && !hasComment) {
          newErrors.documentation = 'Quick verification requires either a receipt attachment OR justification comment';
        }
      } else if (formData.verificationType === 'detailed') {
        if (!hasReceipt) {
          newErrors.documentation = 'Detailed verification requires a receipt attachment';
        }
        if (!hasComment) {
          newErrors.documentation = 'Detailed verification requires justification comments';
        }
      }
    } else {
      // For flagged costs, at least require some change
      const hasAmountChange = cost && Number(formData.amount) !== cost.amount;
      const hasNotesChange = cost && formData.notes !== (cost.notes || '');
      const hasFileUpload = selectedFiles && selectedFiles.length > 0;
      const hasComment = formData.resolutionComment.trim().length > 0;

      if (!hasAmountChange && !hasNotesChange && !hasFileUpload && !hasComment) {
        newErrors.general = 'Please make at least one change or provide a comment to resolve this flag.';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const uploadFiles = async (costId: string): Promise<Attachment[]> => {
    if (!selectedFiles || selectedFiles.length === 0) return [];

    const uploadedAttachments: Attachment[] = [];
    setUploading(true);

    try {
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        const fileExt = file.name.split('.').pop();
        const fileName = `${costId}/${Date.now()}-${i}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('trip-documents')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('trip-documents')
          .getPublicUrl(fileName);

        const { data: attachmentData, error: attachmentError } = await supabase
          .from('cost_attachments')
          .insert({
            cost_id: costId,
            filename: file.name,
            file_path: fileName,
            file_url: urlData.publicUrl,
            file_type: file.type,
            file_size: file.size,
          })
          .select()
          .single();

        if (attachmentError) throw attachmentError;

        uploadedAttachments.push({
          id: attachmentData.id,
          filename: attachmentData.filename,
          file_url: attachmentData.file_url,
          file_type: attachmentData.file_type,
          file_size: attachmentData.file_size,
          uploaded_at: attachmentData.created_at,
          cost_entry_id: attachmentData.cost_id,
        });
      }
    } catch (error) {
      console.error('Error uploading files:', error);
      throw new Error('Failed to upload files');
    } finally {
      setUploading(false);
    }

    return uploadedAttachments;
  };

  const handleResolve = async () => {
    if (!cost || !validateForm()) return;

    try {
      setUploading(true);

      await uploadFiles(cost.id);

      const investigationNotes = cost.investigation_notes
        ? `${cost.investigation_notes}\n\n--- RESOLUTION ---\n${formData.resolutionComment}\nVerification Type: ${formData.verificationType}`
        : `Resolution: ${formData.resolutionComment}\nVerification Type: ${formData.verificationType}`;

      // Update cost entry
      const updateData: Record<string, string | number | null> = {
        amount: Number(formData.amount),
        notes: formData.notes,
        investigation_status: 'resolved',
        investigation_notes: investigationNotes,
        resolved_at: new Date().toISOString(),
      };

      // Add verification fields for unverified costs
      if (isUnverifiedCosts) {
        updateData.verification_type = formData.verificationType;
        updateData.verification_comments = formData.resolutionComment;
        updateData.verified_at = new Date().toISOString();
        updateData.verified_by = 'user';
      }

      const { error: updateError } = await supabase
        .from('cost_entries')
        .update(updateData)
        .eq('id', cost.id);

      if (updateError) throw updateError;

      // Check if there are any remaining unverified costs for this trip
      const { count: remainingUnverified } = await supabase
        .from('cost_entries')
        .select('id', { count: 'exact', head: true })
        .eq('trip_id', cost.trip_id)
        .neq('investigation_status', 'resolved');

      // If this was the last unverified expense, try to resolve the alert
      if (remainingUnverified === 0 && cost.trip_id) {
        const { success, missingDocs } = await resolveUnverifiedCostsAlert(
          cost.trip_id,
          `All expenses verified: ${formData.resolutionComment}`,
          'user'
        );

        if (!success && missingDocs) {
          toast({
            title: 'Documentation Required',
            description: `Some expenses need proper documentation: ${missingDocs.join(', ')}`,
            variant: 'destructive',
          });
        }
      }

      toast({
        title: 'Success',
        description: isUnverifiedCosts ? 'Expense verified successfully' : 'Flag resolved successfully',
      });

      onResolve();
    } catch (error) {
      console.error('Error resolving:', error);
      toast({
        title: 'Error',
        description: `Failed to ${isUnverifiedCosts ? 'verify' : 'resolve'} expense`,
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteAttachment = async (attachmentId: string) => {
    try {
      const { error } = await supabase
        .from('cost_attachments')
        .delete()
        .eq('id', attachmentId);

      if (error) throw error;

      setExistingAttachments(prev => prev.filter(att => att.id !== attachmentId));

      toast({
        title: 'Success',
        description: 'Attachment deleted',
      });
    } catch (error) {
      console.error('Error deleting attachment:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete attachment',
        variant: 'destructive',
      });
    }
  };

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    const symbol = currency === 'USD' ? '$' : 'R';
    return `${symbol}${amount.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  if (!cost) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isUnverifiedCosts ? 'Verify Expense' : 'Resolve Flag'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Flag Information */}
          <div className={`p-4 rounded-lg ${isUnverifiedCosts ? 'bg-blue-50 border border-blue-200' : 'bg-amber-50 border border-amber-200'}`}>
            <div className="flex items-start space-x-3">
              {isUnverifiedCosts ? (
                <Info className="w-5 h-5 text-blue-600 mt-0.5" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
              )}
              <div>
                <h3 className={`font-medium ${isUnverifiedCosts ? 'text-blue-800' : 'text-amber-800'}`}>
                  {isUnverifiedCosts ? 'Verification Required' : 'Flag Details'}
                </h3>
                {!isUnverifiedCosts && cost.flag_reason && (
                  <p className="text-sm text-amber-700 mt-1">
                    <span className="font-medium">Reason:</span> {cost.flag_reason}
                  </p>
                )}
                {isUnverifiedCosts && (
                  <p className="text-sm text-blue-700 mt-1">
                    Please provide documentation to verify this expense
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Original Cost Details */}
          <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Original Amount</Label>
              <p className="text-lg font-semibold">{formatCurrency(cost.amount, cost.currency)}</p>
            </div>
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Category</Label>
              <p className="font-semibold">{cost.category}</p>
            </div>
          </div>

          {/* Verification Type - Only for unverified costs */}
          {isUnverifiedCosts && (
            <div>
              <Label>Verification Type</Label>
              <div className="flex gap-4 mt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    value="quick"
                    checked={formData.verificationType === 'quick'}
                    onChange={() => setFormData(prev => ({ ...prev, verificationType: 'quick' }))}
                    className="w-4 h-4"
                  />
                  <span>Quick Verify</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    value="detailed"
                    checked={formData.verificationType === 'detailed'}
                    onChange={() => setFormData(prev => ({ ...prev, verificationType: 'detailed' }))}
                    className="w-4 h-4"
                  />
                  <span>Detailed Verify</span>
                </label>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {formData.verificationType === 'quick'
                  ? 'Quick verification requires either a receipt OR justification comment'
                  : 'Detailed verification requires BOTH a receipt AND justification comment'}
              </p>
            </div>
          )}

          {/* Form Fields */}
          <div>
            <Label htmlFor="amount">Corrected Amount *</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              value={formData.amount}
              onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
            />
            {errors.amount && (
              <p className="text-sm text-destructive mt-1">{errors.amount}</p>
            )}
          </div>

          <div>
            <Label htmlFor="notes">Updated Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              rows={3}
              placeholder="Add additional notes..."
            />
          </div>

          <div>
            <Label htmlFor="resolutionComment">Resolution / Verification Comment *</Label>
            <Textarea
              id="resolutionComment"
              value={formData.resolutionComment}
              onChange={(e) => setFormData(prev => ({ ...prev, resolutionComment: e.target.value }))}
              rows={4}
              placeholder={isUnverifiedCosts
                ? "Provide justification for this expense..."
                : "Explain how this flag was resolved..."}
            />
            {errors.resolutionComment && (
              <p className="text-sm text-destructive mt-1">{errors.resolutionComment}</p>
            )}
          </div>

          {/* File Upload */}
          <div>
            <Label>Supporting Documents</Label>
            <Input
              type="file"
              onChange={(e) => setSelectedFiles(e.target.files)}
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
              multiple
            />
            <p className="text-xs text-muted-foreground mt-1">
              Upload receipts, invoices, or other supporting documents
              {isUnverifiedCosts && formData.verificationType === 'detailed' && ' (Required for detailed verification)'}
            </p>
          </div>

          {/* Existing Attachments */}
          {existingAttachments.length > 0 && (
            <div>
              <Label>Existing Attachments</Label>
              <div className="space-y-2 mt-2">
                {existingAttachments.map((attachment) => (
                  <div key={attachment.id} className="flex items-center justify-between p-3 bg-muted rounded-md border">
                    <div className="flex items-center space-x-2">
                      <FileText className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{attachment.filename}</span>
                    </div>
                    <div className="flex space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => window.open(attachment.file_url, '_blank')}
                      >
                        View
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDeleteAttachment(attachment.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Documentation Error */}
          {errors.documentation && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-md">
              <p className="text-sm text-amber-800">{errors.documentation}</p>
            </div>
          )}

          {/* General Error */}
          {errors.general && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-md">
              <p className="text-sm text-amber-800">{errors.general}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end space-x-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={uploading}
            >
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
            <Button
              onClick={handleResolve}
              disabled={uploading}
            >
              {uploading ? (
                <>
                  <Upload className="w-4 h-4 mr-2 animate-spin" />
                  {isUnverifiedCosts ? 'Verifying...' : 'Resolving...'}
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  {isUnverifiedCosts ? 'Verify Expense' : 'Resolve Flag'}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FlagResolutionModal;
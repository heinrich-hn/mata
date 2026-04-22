import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { TablesInsert } from '@/integrations/supabase/types';

export const DOCUMENT_TYPES = [
  { value: 'license', label: 'Driver License', shortLabel: 'License' },
  { value: 'pdp', label: 'Professional Driving Permit (PDP/International)', shortLabel: 'PDP/International' },
  { value: 'passport', label: 'Passport', shortLabel: 'Passport' },
  { value: 'medical', label: 'Medical Certificate', shortLabel: 'Medical' },
  { value: 'retest', label: 'Retest Certificate', shortLabel: 'Retest' },
  { value: 'defensive_driving', label: 'Defensive Driving Permit', shortLabel: 'Defensive' },
] as const;

export type DriverDocumentType = typeof DOCUMENT_TYPES[number]['value'];

export interface DriverDocument {
  id: string;
  driver_id: string;
  document_type: DriverDocumentType;
  document_number: string | null;
  expiry_date: string | null;
  file_url: string | null;
  file_path: string | null;
  file_name: string | null;
  file_size: number | null;
  mime_type: string | null;
  uploaded_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface UpsertDocumentParams {
  driverId: string;
  documentType: DriverDocumentType;
  expiryDate?: string | null;
  documentNumber?: string | null;
  notes?: string | null;
  file?: File | null;
  uploadedBy?: string;
}

export const useDriverDocuments = (driverId?: string) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch documents for a specific driver
  const {
    data: documents = [],
    isLoading,
    refetch,
  } = useQuery<DriverDocument[]>({
    queryKey: ['driver-documents', driverId],
    queryFn: async () => {
      if (!driverId) return [];
      const { data, error } = await supabase
        .from('driver_documents')
        .select('*')
        .eq('driver_id', driverId)
        .order('document_type');

      if (error) throw error;
      return (data || []) as DriverDocument[];
    },
    enabled: !!driverId,
    staleTime: 2 * 60 * 1000,
  });

  // Get a specific document by type
  const getDocument = (type: DriverDocumentType): DriverDocument | undefined => {
    return documents.find(d => d.document_type === type);
  };

  // Get expiry status for a document
  const getExpiryStatus = (expiryDate: string | null): 'valid' | 'expiring' | 'expired' | 'unknown' => {
    if (!expiryDate) return 'unknown';
    const expiry = new Date(expiryDate);
    const today = new Date();
    const daysUntil = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (daysUntil < 0) return 'expired';
    if (daysUntil <= 30) return 'expiring';
    return 'valid';
  };

  // Upload file to storage
  const uploadFile = async (driverId: string, documentType: string, file: File): Promise<{ url: string; path: string }> => {
    const ext = file.name.split('.').pop();
    const fileName = `${driverId}/${documentType}-${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('driver-documents')
      .upload(fileName, file, { upsert: true });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('driver-documents')
      .getPublicUrl(fileName);

    return { url: publicUrl, path: fileName };
  };

  // Delete file from storage
  const deleteFile = async (filePath: string) => {
    const { error } = await supabase.storage
      .from('driver-documents')
      .remove([filePath]);

    if (error) console.error('Error deleting file:', error);
  };

  // Upsert document (create or update)
  const upsertMutation = useMutation({
    mutationFn: async (params: UpsertDocumentParams) => {
      let fileUrl: string | null = null;
      let filePath: string | null = null;
      let fileName: string | null = null;
      let fileSize: number | null = null;
      let mimeType: string | null = null;

      // Upload file if provided
      if (params.file) {
        // Delete old file if exists
        const existingDoc = getDocument(params.documentType);
        if (existingDoc?.file_path) {
          await deleteFile(existingDoc.file_path);
        }

        const result = await uploadFile(params.driverId, params.documentType, params.file);
        fileUrl = result.url;
        filePath = result.path;
        fileName = params.file.name;
        fileSize = params.file.size;
        mimeType = params.file.type;
      }

      // Build update object
      const updateData: TablesInsert<'driver_documents'> = {
        driver_id: params.driverId,
        document_type: params.documentType,
      };

      if (params.expiryDate !== undefined) updateData.expiry_date = params.expiryDate || null;
      if (params.documentNumber !== undefined) updateData.document_number = params.documentNumber || null;
      if (params.notes !== undefined) updateData.notes = params.notes || null;
      if (params.uploadedBy) updateData.uploaded_by = params.uploadedBy;

      if (params.file) {
        updateData.file_url = fileUrl;
        updateData.file_path = filePath;
        updateData.file_name = fileName;
        updateData.file_size = fileSize;
        updateData.mime_type = mimeType;
      }

      // Upsert - insert or update on conflict
      const { data, error } = await supabase
        .from('driver_documents')
        .upsert(updateData, {
          onConflict: 'driver_id,document_type',
        })
        .select()
        .single();

      if (error) throw error;
      return data as DriverDocument;
    },
    onSuccess: (_data, params) => {
      const docLabel = DOCUMENT_TYPES.find(t => t.value === params.documentType)?.label || params.documentType;
      queryClient.invalidateQueries({ queryKey: ['driver-documents', params.driverId] });
      queryClient.invalidateQueries({ queryKey: ['driver-documents-summary'] });
      toast({
        title: 'Document Saved',
        description: `${docLabel} has been updated successfully.`,
      });
    },
    onError: (error: Error) => {
      console.error('Error saving document:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to save document.',
        variant: 'destructive',
      });
    },
  });

  // Delete document
  const deleteMutation = useMutation({
    mutationFn: async ({ documentId, filePath: path }: { documentId: string; filePath?: string | null }) => {
      if (path) {
        await deleteFile(path);
      }
      const { error } = await supabase
        .from('driver_documents')
        .delete()
        .eq('id', documentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['driver-documents', driverId] });
      queryClient.invalidateQueries({ queryKey: ['driver-documents-summary'] });
      toast({
        title: 'Document Deleted',
        description: 'Document has been removed.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete document.',
        variant: 'destructive',
      });
    },
  });

  // Get summary of all document expiry statuses
  const expiryAlerts = documents.reduce((alerts, doc) => {
    const status = getExpiryStatus(doc.expiry_date);
    if (status === 'expired' || status === 'expiring') {
      alerts.push({
        documentType: doc.document_type,
        label: DOCUMENT_TYPES.find(t => t.value === doc.document_type)?.shortLabel || doc.document_type,
        expiryDate: doc.expiry_date!,
        status,
      });
    }
    return alerts;
  }, [] as Array<{ documentType: string; label: string; expiryDate: string; status: 'expired' | 'expiring' }>);

  return {
    documents,
    isLoading,
    refetch,
    getDocument,
    getExpiryStatus,
    expiryAlerts,
    upsertDocument: upsertMutation.mutateAsync,
    isUpserting: upsertMutation.isPending,
    deleteDocument: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
  };
};

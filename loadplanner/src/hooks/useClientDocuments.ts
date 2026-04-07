import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

const BUCKET_NAME = 'client-documents';

export type DocumentCategory =
    | 'price_list'
    | 'git_invoice'
    | 'pod'
    | 'contract'
    | 'statement'
    | 'other';

export const DOCUMENT_CATEGORIES: { value: DocumentCategory; label: string }[] = [
    { value: 'price_list', label: 'Price List' },
    { value: 'git_invoice', label: 'GIT Invoice' },
    { value: 'pod', label: 'Proof of Delivery' },
    { value: 'contract', label: 'Contract' },
    { value: 'statement', label: 'Statement' },
    { value: 'other', label: 'Other' },
];

export interface ClientDocument {
    id: string;
    client_id: string;
    load_id: string | null;
    category: string;
    title: string;
    file_name: string;
    file_url: string;
    file_size: number | null;
    mime_type: string | null;
    notes: string | null;
    uploaded_by: string | null;
    created_at: string;
}

export interface UploadClientDocumentInput {
    clientId: string;
    file: File;
    category: DocumentCategory;
    title: string;
    loadId?: string | null;
    notes?: string | null;
    uploadedBy?: string | null;
}

/**
 * Fetch all documents for a specific client
 */
export function useClientDocuments(clientId: string | undefined) {
    return useQuery({
        queryKey: ['client-documents', clientId],
        queryFn: async () => {
            if (!clientId) return [];
            const { data, error } = await supabase
                .from('client_documents')
                .select('*')
                .eq('client_id', clientId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data as ClientDocument[];
        },
        enabled: !!clientId,
    });
}

/**
 * Upload a document to storage and insert metadata into client_documents table
 */
export function useUploadClientDocument() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (input: UploadClientDocumentInput) => {
            const { clientId, file, category, title, loadId, notes, uploadedBy } = input;

            // Upload file to storage
            const fileExt = file.name.split('.').pop();
            const storagePath = `${clientId}/${category}_${Date.now()}.${fileExt}`;

            const { data: uploadData, error: uploadError } = await supabase.storage
                .from(BUCKET_NAME)
                .upload(storagePath, file, {
                    cacheControl: '3600',
                    upsert: true,
                });

            if (uploadError) throw uploadError;

            // Get public URL
            const { data: urlData } = supabase.storage
                .from(BUCKET_NAME)
                .getPublicUrl(uploadData.path);

            // Insert metadata row
            const { data, error } = await supabase
                .from('client_documents')
                .insert({
                    client_id: clientId,
                    load_id: loadId || null,
                    category,
                    title,
                    file_name: file.name,
                    file_url: urlData.publicUrl,
                    file_size: file.size,
                    mime_type: file.type || null,
                    notes: notes || null,
                    uploaded_by: uploadedBy || null,
                })
                .select()
                .single();

            if (error) throw error;
            return data as ClientDocument;
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['client-documents', data.client_id] });
            toast({
                title: 'Document uploaded',
                description: `"${data.title}" has been uploaded successfully.`,
            });
        },
        onError: (error) => {
            toast({
                title: 'Upload failed',
                description: error.message,
                variant: 'destructive',
            });
        },
    });
}

/**
 * Delete a document from storage and remove the metadata row
 */
export function useDeleteClientDocument() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (doc: ClientDocument) => {
            // Extract storage path from the public URL
            const url = new URL(doc.file_url);
            const pathMatch = url.pathname.match(/\/storage\/v1\/object\/public\/client-documents\/(.+)/);
            const storagePath = pathMatch?.[1];

            if (storagePath) {
                const { error: storageError } = await supabase.storage
                    .from(BUCKET_NAME)
                    .remove([decodeURIComponent(storagePath)]);

                if (storageError) {
                    console.error('Storage delete error:', storageError);
                }
            }

            // Delete metadata row
            const { error } = await supabase
                .from('client_documents')
                .delete()
                .eq('id', doc.id);

            if (error) throw error;
            return doc;
        },
        onSuccess: (doc) => {
            queryClient.invalidateQueries({ queryKey: ['client-documents', doc.client_id] });
            toast({
                title: 'Document deleted',
                description: `"${doc.title}" has been removed.`,
            });
        },
        onError: (error) => {
            toast({
                title: 'Delete failed',
                description: error.message,
                variant: 'destructive',
            });
        },
    });
}

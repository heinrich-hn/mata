import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export interface IncidentDocument {
  id: string;
  incident_id: string;
  document_type: string;
  name: string;
  description: string | null;
  file_url: string;
  file_path: string | null;
  file_size: number | null;
  mime_type: string | null;
  uploaded_by: string;
  uploaded_at: string;
  created_at: string;
  updated_at: string;
}

export interface IncidentTimelineEvent {
  id: string;
  incident_id: string;
  event_type: string;
  event_title: string;
  event_description: string | null;
  old_status: string | null;
  new_status: string | null;
  document_id: string | null;
  performed_by: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export const DOCUMENT_TYPES = [
  { value: "incident_report", label: "Incident Report" },
  { value: "police_report", label: "Police Report" },
  { value: "insurance_application", label: "Insurance Application" },
  { value: "insurance_claim", label: "Insurance Claim" },
  { value: "witness_statement", label: "Witness Statement" },
  { value: "damage_assessment", label: "Damage Assessment" },
  { value: "repair_quote", label: "Repair Quote" },
  { value: "medical_report", label: "Medical Report" },
  { value: "photo_evidence", label: "Photo Evidence" },
  { value: "video_evidence", label: "Video Evidence" },
  { value: "correspondence", label: "Correspondence" },
  { value: "other", label: "Other" },
];

export const useIncidentDocuments = (incidentId: string | null) => {
  return useQuery({
    queryKey: ["incident-documents", incidentId],
    queryFn: async () => {
      if (!incidentId) return [];

      const { data, error } = await supabase
        .from("incident_documents")
        .select("*")
        .eq("incident_id", incidentId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as IncidentDocument[];
    },
    enabled: !!incidentId,
  });
};

export const useIncidentTimeline = (incidentId: string | null) => {
  return useQuery({
    queryKey: ["incident-timeline", incidentId],
    queryFn: async () => {
      if (!incidentId) return [];

      const { data, error } = await supabase
        .from("incident_timeline")
        .select("*")
        .eq("incident_id", incidentId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return (data || []) as IncidentTimelineEvent[];
    },
    enabled: !!incidentId,
  });
};

export const useUploadIncidentDocument = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      incidentId,
      file,
      documentType,
      description,
      uploadedBy,
    }: {
      incidentId: string;
      file: File;
      documentType: string;
      description?: string;
      uploadedBy: string;
    }) => {
      // Upload file to storage
      const fileName = `${incidentId}/${Date.now()}-${file.name}`;

      const { error: uploadError } = await supabase.storage
        .from("incident-documents")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("incident-documents")
        .getPublicUrl(fileName);

      // Create document record
      const { data, error } = await supabase
        .from("incident_documents")
        .insert({
          incident_id: incidentId,
          document_type: documentType as "incident_report" | "police_report" | "insurance_application" | "insurance_claim" | "witness_statement" | "damage_assessment" | "repair_quote" | "medical_report" | "photo_evidence" | "video_evidence" | "correspondence" | "other",
          name: file.name,
          description: description || null,
          file_url: urlData.publicUrl,
          file_path: fileName,
          file_size: file.size,
          mime_type: file.type,
          uploaded_by: uploadedBy,
        })
        .select()
        .single();

      if (error) throw error;

      // Add timeline entry
      await supabase.from("incident_timeline").insert({
        incident_id: incidentId,
        event_type: "document_added",
        event_title: "Document Uploaded",
        event_description: `${file.name} (${documentType.replace(/_/g, " ")}) was uploaded`,
        document_id: data.id,
        performed_by: uploadedBy,
      });

      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["incident-documents", variables.incidentId],
      });
      queryClient.invalidateQueries({
        queryKey: ["incident-timeline", variables.incidentId],
      });
      toast({
        title: "Document Uploaded",
        description: "The document has been uploaded successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Upload Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
};

export const useDeleteIncidentDocument = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      document,
      deletedBy,
    }: {
      document: IncidentDocument;
      deletedBy: string;
    }) => {
      // Delete from storage if path exists
      if (document.file_path) {
        await supabase.storage
          .from("incident-documents")
          .remove([document.file_path]);
      }

      // Add timeline entry before deleting
      await supabase.from("incident_timeline").insert({
        incident_id: document.incident_id,
        event_type: "document_removed",
        event_title: "Document Removed",
        event_description: `${document.name} was removed`,
        performed_by: deletedBy,
      });

      // Delete document record
      const { error } = await supabase
        .from("incident_documents")
        .delete()
        .eq("id", document.id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["incident-documents", variables.document.incident_id],
      });
      queryClient.invalidateQueries({
        queryKey: ["incident-timeline", variables.document.incident_id],
      });
      toast({
        title: "Document Deleted",
        description: "The document has been removed.",
      });
    },
    onError: (error) => {
      toast({
        title: "Delete Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
};

export const useAddTimelineNote = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      incidentId,
      note,
      addedBy,
    }: {
      incidentId: string;
      note: string;
      addedBy: string;
    }) => {
      const { data, error } = await supabase
        .from("incident_timeline")
        .insert({
          incident_id: incidentId,
          event_type: "note_added",
          event_title: "Note Added",
          event_description: note,
          performed_by: addedBy,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["incident-timeline", variables.incidentId],
      });
      toast({
        title: "Note Added",
        description: "Your note has been added to the timeline.",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
};
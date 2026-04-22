-- Drop the unique constraint on work_documents.document_number.
-- Vehicle compliance documents reuse category-based numbers (e.g. "INSURANCE", "COF")
-- across vehicles, so uniqueness is not appropriate here.
ALTER TABLE public.work_documents DROP CONSTRAINT IF EXISTS work_documents_document_number_key;

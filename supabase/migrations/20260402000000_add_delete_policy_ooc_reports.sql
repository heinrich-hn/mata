-- Allow authenticated users to delete out_of_commission_reports
CREATE POLICY "Authenticated users can delete out_of_commission_reports"
  ON out_of_commission_reports FOR DELETE TO authenticated USING (true);

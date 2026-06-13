
CREATE POLICY "deal-docs sme upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'deal-docs' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "deal-docs sme read own" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'deal-docs' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "deal-docs admin read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'deal-docs' AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "deal-docs investor read funded" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'deal-docs' AND EXISTS (
      SELECT 1 FROM public.deals d
      WHERE d.investor_id = auth.uid() AND ((storage.foldername(name))[1] = d.sme_id::text)
    )
  );

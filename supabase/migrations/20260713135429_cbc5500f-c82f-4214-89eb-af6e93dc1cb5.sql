
CREATE POLICY "assinaturas_insert_own_folder" ON storage.objects FOR INSERT TO authenticated WITH CHECK (
  bucket_id = 'assinaturas' AND (storage.foldername(name))[1] = auth.uid()::text
);
CREATE POLICY "assinaturas_select_own_or_supervisor" ON storage.objects FOR SELECT TO authenticated USING (
  bucket_id = 'assinaturas' AND (
    (storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(), 'supervisor')
  )
);

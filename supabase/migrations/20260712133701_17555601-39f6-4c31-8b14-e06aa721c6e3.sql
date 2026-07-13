-- Políticas de acesso ao bucket de assinaturas faciais (privado)
-- Cuidador envia selfies apenas na própria pasta (userId/...)
CREATE POLICY "Cuidador envia própria assinatura" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'assinaturas'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Dono da selfie e supervisores podem visualizar
CREATE POLICY "Ver assinaturas (dono ou supervisor)" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'assinaturas'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.has_role(auth.uid(), 'supervisor')
  )
);
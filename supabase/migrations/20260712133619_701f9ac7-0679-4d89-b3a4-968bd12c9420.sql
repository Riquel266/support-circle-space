-- Enum de papéis
CREATE TYPE public.app_role AS ENUM ('supervisor', 'cuidador');

-- Enum de tipos de registro
CREATE TYPE public.record_type AS ENUM ('sinais_vitais', 'medicacao', 'alimentacao', 'ocorrencia');

-- Enum de severidade de alertas
CREATE TYPE public.alert_severity AS ENUM ('info', 'atencao', 'critico');

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  phone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============ USER ROLES ============
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Função security definer para checar papel
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- ============ ELDERS (IDOSOS) ============
CREATE TABLE public.elders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  birth_date date,
  medical_notes text,
  photo_url text,
  active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.elders TO authenticated;
GRANT ALL ON public.elders TO service_role;
ALTER TABLE public.elders ENABLE ROW LEVEL SECURITY;

-- ============ ASSIGNMENTS (VÍNCULO CUIDADOR-IDOSO) ============
CREATE TABLE public.assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  caregiver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  elder_id uuid NOT NULL REFERENCES public.elders(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (caregiver_id, elder_id)
);
GRANT SELECT, INSERT, DELETE ON public.assignments TO authenticated;
GRANT ALL ON public.assignments TO service_role;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;

-- Função para checar se o cuidador está vinculado ao idoso
CREATE OR REPLACE FUNCTION public.is_assigned(_user_id uuid, _elder_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.assignments
    WHERE caregiver_id = _user_id AND elder_id = _elder_id
  )
$$;

-- ============ CARE RECORDS (REGISTROS DE CUIDADO) ============
CREATE TABLE public.care_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  elder_id uuid NOT NULL REFERENCES public.elders(id) ON DELETE CASCADE,
  caregiver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  record_type public.record_type NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  selfie_path text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.care_records TO authenticated;
GRANT ALL ON public.care_records TO service_role;
ALTER TABLE public.care_records ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_care_records_elder ON public.care_records(elder_id, created_at DESC);
CREATE INDEX idx_care_records_caregiver ON public.care_records(caregiver_id, created_at DESC);

-- ============ ALERTS ============
CREATE TABLE public.alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  elder_id uuid NOT NULL REFERENCES public.elders(id) ON DELETE CASCADE,
  care_record_id uuid REFERENCES public.care_records(id) ON DELETE SET NULL,
  severity public.alert_severity NOT NULL DEFAULT 'atencao',
  message text NOT NULL,
  resolved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.alerts TO authenticated;
GRANT ALL ON public.alerts TO service_role;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;

-- ============ TRIGGERS ============
-- Perfil + papel automáticos ao criar usuário
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.raw_user_meta_data->>'phone'
  );
  INSERT INTO public.user_roles (user_id, role)
  VALUES (
    NEW.id,
    CASE WHEN COALESCE(NEW.raw_user_meta_data->>'role', 'supervisor') = 'cuidador'
      THEN 'cuidador'::public.app_role
      ELSE 'supervisor'::public.app_role
    END
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- updated_at automático
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_elders_updated BEFORE UPDATE ON public.elders
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Gera alertas automáticos a partir de registros
CREATE OR REPLACE FUNCTION public.generate_alerts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sys int;
  dia int;
  temp numeric;
  glic numeric;
  bpm int;
BEGIN
  IF NEW.record_type = 'sinais_vitais' THEN
    sys := NULLIF(NEW.data->>'pressao_sistolica','')::int;
    dia := NULLIF(NEW.data->>'pressao_diastolica','')::int;
    temp := NULLIF(NEW.data->>'temperatura','')::numeric;
    glic := NULLIF(NEW.data->>'glicemia','')::numeric;
    bpm := NULLIF(NEW.data->>'batimentos','')::int;

    IF sys IS NOT NULL AND (sys >= 180 OR sys <= 90) THEN
      INSERT INTO public.alerts (elder_id, care_record_id, severity, message)
      VALUES (NEW.elder_id, NEW.id, 'critico', 'Pressão sistólica fora do normal: ' || sys || ' mmHg');
    ELSIF sys IS NOT NULL AND (sys >= 140 OR sys <= 100) THEN
      INSERT INTO public.alerts (elder_id, care_record_id, severity, message)
      VALUES (NEW.elder_id, NEW.id, 'atencao', 'Pressão sistólica alterada: ' || sys || ' mmHg');
    END IF;

    IF temp IS NOT NULL AND (temp >= 38.5 OR temp <= 35) THEN
      INSERT INTO public.alerts (elder_id, care_record_id, severity, message)
      VALUES (NEW.elder_id, NEW.id, 'critico', 'Temperatura fora do normal: ' || temp || ' °C');
    ELSIF temp IS NOT NULL AND temp >= 37.5 THEN
      INSERT INTO public.alerts (elder_id, care_record_id, severity, message)
      VALUES (NEW.elder_id, NEW.id, 'atencao', 'Temperatura elevada: ' || temp || ' °C');
    END IF;

    IF glic IS NOT NULL AND (glic >= 250 OR glic <= 60) THEN
      INSERT INTO public.alerts (elder_id, care_record_id, severity, message)
      VALUES (NEW.elder_id, NEW.id, 'critico', 'Glicemia fora do normal: ' || glic || ' mg/dL');
    ELSIF glic IS NOT NULL AND (glic >= 180 OR glic <= 70) THEN
      INSERT INTO public.alerts (elder_id, care_record_id, severity, message)
      VALUES (NEW.elder_id, NEW.id, 'atencao', 'Glicemia alterada: ' || glic || ' mg/dL');
    END IF;

    IF bpm IS NOT NULL AND (bpm >= 130 OR bpm <= 45) THEN
      INSERT INTO public.alerts (elder_id, care_record_id, severity, message)
      VALUES (NEW.elder_id, NEW.id, 'critico', 'Batimentos fora do normal: ' || bpm || ' bpm');
    ELSIF bpm IS NOT NULL AND (bpm >= 110 OR bpm <= 55) THEN
      INSERT INTO public.alerts (elder_id, care_record_id, severity, message)
      VALUES (NEW.elder_id, NEW.id, 'atencao', 'Batimentos alterados: ' || bpm || ' bpm');
    END IF;
  ELSIF NEW.record_type = 'ocorrencia' THEN
    IF COALESCE(NEW.data->>'gravidade','') = 'grave' THEN
      INSERT INTO public.alerts (elder_id, care_record_id, severity, message)
      VALUES (NEW.elder_id, NEW.id, 'critico', 'Ocorrência grave registrada: ' || COALESCE(NEW.data->>'tipo_ocorrencia', 'ocorrência'));
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_generate_alerts AFTER INSERT ON public.care_records
FOR EACH ROW EXECUTE FUNCTION public.generate_alerts();

-- ============ RLS POLICIES ============
-- profiles
CREATE POLICY "Ver próprio perfil" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(), 'supervisor'));
CREATE POLICY "Cuidadores veem perfis de supervisores" ON public.profiles FOR SELECT TO authenticated
  USING (public.has_role(id, 'supervisor'));
CREATE POLICY "Atualizar próprio perfil" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid());

-- user_roles
CREATE POLICY "Ver próprios papéis" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'supervisor'));

-- elders
CREATE POLICY "Supervisor gerencia idosos" ON public.elders FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'supervisor'))
  WITH CHECK (public.has_role(auth.uid(), 'supervisor'));
CREATE POLICY "Cuidador vê idosos vinculados" ON public.elders FOR SELECT TO authenticated
  USING (public.is_assigned(auth.uid(), id));

-- assignments
CREATE POLICY "Supervisor gerencia vínculos" ON public.assignments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'supervisor'))
  WITH CHECK (public.has_role(auth.uid(), 'supervisor'));
CREATE POLICY "Cuidador vê próprios vínculos" ON public.assignments FOR SELECT TO authenticated
  USING (caregiver_id = auth.uid());

-- care_records
CREATE POLICY "Supervisor vê todos registros" ON public.care_records FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'supervisor'));
CREATE POLICY "Cuidador vê registros de idosos vinculados" ON public.care_records FOR SELECT TO authenticated
  USING (public.is_assigned(auth.uid(), elder_id));
CREATE POLICY "Cuidador insere registros de idosos vinculados" ON public.care_records FOR INSERT TO authenticated
  WITH CHECK (caregiver_id = auth.uid() AND public.is_assigned(auth.uid(), elder_id));

-- alerts
CREATE POLICY "Supervisor vê e resolve alertas" ON public.alerts FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'supervisor'));
CREATE POLICY "Supervisor atualiza alertas" ON public.alerts FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'supervisor'));
CREATE POLICY "Cuidador vê alertas de idosos vinculados" ON public.alerts FOR SELECT TO authenticated
  USING (public.is_assigned(auth.uid(), elder_id));

-- ============ REALTIME ============
ALTER PUBLICATION supabase_realtime ADD TABLE public.care_records;
ALTER PUBLICATION supabase_realtime ADD TABLE public.alerts;
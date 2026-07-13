-- Desativar Row Level Security (RLS) em todas as tabelas para permitir acesso sem autenticação
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.elders DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.care_records DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts DISABLE ROW LEVEL SECURITY;

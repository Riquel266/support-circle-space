-- Confirmar todos os usuários existentes que ainda não foram confirmados
UPDATE auth.users
SET email_confirmed_at = COALESCE(email_confirmed_at, now()),
    confirmed_at = COALESCE(confirmed_at, now())
WHERE email_confirmed_at IS NULL;

-- Função para confirmar e-mails automaticamente no momento do insert
CREATE OR REPLACE FUNCTION public.handle_auto_confirm_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  NEW.email_confirmed_at = COALESCE(NEW.email_confirmed_at, now());
  NEW.confirmed_at = COALESCE(NEW.confirmed_at, now());
  RETURN NEW;
END;
$$;

-- Trigger para executar antes de inserir um novo usuário na tabela auth.users
CREATE OR REPLACE TRIGGER trg_auto_confirm_user
BEFORE INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_auto_confirm_user();

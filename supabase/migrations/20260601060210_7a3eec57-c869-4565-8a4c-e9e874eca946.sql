ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS employee_code text,
  ADD COLUMN IF NOT EXISTS gender text,
  ADD COLUMN IF NOT EXISTS age integer,
  ADD COLUMN IF NOT EXISTS job_role text,
  ADD COLUMN IF NOT EXISTS education text,
  ADD COLUMN IF NOT EXISTS monthly_income numeric,
  ADD COLUMN IF NOT EXISTS years_at_company numeric,
  ADD COLUMN IF NOT EXISTS years_in_current_role numeric,
  ADD COLUMN IF NOT EXISTS years_since_last_promotion numeric,
  ADD COLUMN IF NOT EXISTS total_working_years numeric,
  ADD COLUMN IF NOT EXISTS marital_status text,
  ADD COLUMN IF NOT EXISTS business_travel text,
  ADD COLUMN IF NOT EXISTS overtime text;

-- Roles enum + user_roles
CREATE TYPE public.app_role AS ENUM ('hr', 'employee');

CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  department TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

-- Security definer to avoid recursive RLS
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Dynamic form fields managed by HR
CREATE TABLE public.form_fields (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  field_key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  description TEXT,
  field_type TEXT NOT NULL CHECK (field_type IN ('text','textarea','number','rating','yesno','dropdown','select')),
  options JSONB,
  required BOOLEAN NOT NULL DEFAULT false,
  position INT NOT NULL DEFAULT 0,
  category TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  -- weight used for risk scoring; nullable
  risk_weight NUMERIC,
  -- direction: 'higher_risk_high' or 'higher_risk_low' for rating/number fields
  risk_direction TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Submissions: one per employee, latest version
CREATE TABLE public.submissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  responses JSONB NOT NULL DEFAULT '{}'::jsonb,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Risk assessments cache
CREATE TABLE public.risk_assessments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  risk_score NUMERIC NOT NULL DEFAULT 0,
  risk_level TEXT NOT NULL DEFAULT 'low' CHECK (risk_level IN ('low','medium','high')),
  insights TEXT,
  recommendations TEXT,
  ai_generated BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.risk_assessments ENABLE ROW LEVEL SECURITY;

-- profiles policies
CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "HR view all profiles" ON public.profiles FOR SELECT USING (public.has_role(auth.uid(), 'hr'));
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- user_roles policies
CREATE POLICY "Users view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "HR view all roles" ON public.user_roles FOR SELECT USING (public.has_role(auth.uid(), 'hr'));
CREATE POLICY "Users insert own role on signup" ON public.user_roles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- form_fields: everyone authenticated reads active fields; HR manages
CREATE POLICY "Authenticated read form fields" ON public.form_fields FOR SELECT TO authenticated USING (true);
CREATE POLICY "HR insert form fields" ON public.form_fields FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'hr'));
CREATE POLICY "HR update form fields" ON public.form_fields FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'hr'));
CREATE POLICY "HR delete form fields" ON public.form_fields FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'hr'));

-- submissions
CREATE POLICY "Users view own submission" ON public.submissions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "HR view all submissions" ON public.submissions FOR SELECT USING (public.has_role(auth.uid(),'hr'));
CREATE POLICY "Users insert own submission" ON public.submissions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own submission" ON public.submissions FOR UPDATE USING (auth.uid() = user_id);

-- risk_assessments
CREATE POLICY "Users view own risk" ON public.risk_assessments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "HR view all risk" ON public.risk_assessments FOR SELECT USING (public.has_role(auth.uid(),'hr'));
CREATE POLICY "Users upsert own risk" ON public.risk_assessments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own risk" ON public.risk_assessments FOR UPDATE USING (auth.uid() = user_id);

-- updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_form_fields_updated BEFORE UPDATE ON public.form_fields FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_submissions_updated BEFORE UPDATE ON public.submissions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_risk_updated BEFORE UPDATE ON public.risk_assessments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), NEW.email);
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Seed default form fields
INSERT INTO public.form_fields (field_key, label, description, field_type, options, required, position, category, risk_weight, risk_direction) VALUES
('job_role','Job Role','Your current role at the company','text',NULL,true,1,'Work',NULL,NULL),
('department','Department',NULL,'dropdown','["Engineering","Sales","Marketing","HR","Finance","Operations","Product","Design","Support"]',true,2,'Work',NULL,NULL),
('years_at_company','Years at Company',NULL,'number',NULL,true,3,'Work',1.0,'higher_risk_low'),
('salary_range','Salary Range','Annual salary bracket','dropdown','["< $40k","$40k - $60k","$60k - $80k","$80k - $120k","$120k - $160k","> $160k"]',true,4,'Work',NULL,NULL),
('overtime','Frequent Overtime?',NULL,'yesno',NULL,true,5,'Work',2.0,NULL),
('job_satisfaction','Job Satisfaction','1 = very low, 5 = excellent','rating','{"max":5}',true,6,'Engagement',3.0,'higher_risk_low'),
('work_life_balance','Work-Life Balance','1 = poor, 5 = excellent','rating','{"max":5}',true,7,'Engagement',2.5,'higher_risk_low'),
('manager_relationship','Relationship with Manager','1 = poor, 5 = excellent','rating','{"max":5}',true,8,'Engagement',2.0,'higher_risk_low'),
('career_growth','Career Growth Opportunities','1 = none, 5 = excellent','rating','{"max":5}',true,9,'Engagement',2.0,'higher_risk_low'),
('compensation_fairness','Compensation Feels Fair','1 = no, 5 = absolutely','rating','{"max":5}',true,10,'Engagement',2.0,'higher_risk_low'),
('considering_leaving','Considering Leaving in the next 6 months?',NULL,'yesno',NULL,true,11,'Risk',5.0,NULL),
('feedback','Anything you would like HR to know?',NULL,'textarea',NULL,false,12,'Feedback',NULL,NULL);

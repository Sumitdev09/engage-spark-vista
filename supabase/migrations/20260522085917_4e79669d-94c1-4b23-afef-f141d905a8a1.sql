
CREATE POLICY "HR delete profiles" ON public.profiles FOR DELETE USING (has_role(auth.uid(), 'hr'::app_role));
CREATE POLICY "HR delete submissions" ON public.submissions FOR DELETE USING (has_role(auth.uid(), 'hr'::app_role));
CREATE POLICY "HR delete risk" ON public.risk_assessments FOR DELETE USING (has_role(auth.uid(), 'hr'::app_role));
CREATE POLICY "HR delete user_roles" ON public.user_roles FOR DELETE USING (has_role(auth.uid(), 'hr'::app_role));

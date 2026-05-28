
CREATE POLICY "first admin self-bootstrap" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND role = 'admin'
    AND NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin')
  );

CREATE POLICY "admins grant roles" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Migration to add UPDATE policy for expenses table

CREATE POLICY "Enable update for authenticated users" 
ON public.expenses 
FOR UPDATE 
TO authenticated
USING (true)
WITH CHECK (true);

import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  'https://atgkuhppxugkvehmdhhz.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF0Z2t1aHBweHVna3ZlaG1kaGh6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM4MzI4NzEsImV4cCI6MjA2OTQwODg3MX0.lZ1icv_D8Ahglst07HWCqep_HpTqSXekxFyMsyhJNZs'
);

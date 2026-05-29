import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://jfhnkhrsojdfipuiirly.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmaG5raHJzb2pkZmlwdWlpcmx5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwODA1NjksImV4cCI6MjA5MzY1NjU2OX0.FZZuYfS1fppCZ_mxXh7eigvtcbzvKmBU3fYAjJA7k5w'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

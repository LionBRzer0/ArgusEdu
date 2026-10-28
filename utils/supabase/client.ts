import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // Se a variável estiver em falta ou sem https://, usa um valor fallback seguro para não quebrar a app
  const validUrl = supabaseUrl && supabaseUrl.startsWith('http') 
    ? supabaseUrl 
    : 'https://placeholder.supabase.co'

  const validKey = supabaseAnonKey || 'placeholder-key'

  return createBrowserClient(validUrl, validKey)
}
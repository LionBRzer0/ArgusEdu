import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Cliente Supabase para código de servidor (Route Handlers, Server Components, Server Actions).
 * Lê e escreve a sessão nos cookies do pedido, partilhados com o cliente do browser.
 */
export async function createClient() {
  const cookieStore = await cookies()

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl?.startsWith('http') || !supabaseAnonKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL ou NEXT_PUBLIC_SUPABASE_ANON_KEY em falta ou inválidas')
  }

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch {
          // Chamado a partir de um Server Component, onde não é possível escrever cookies.
          // Pode ser ignorado se houver um proxy/middleware a renovar a sessão.
        }
      },
    },
  })
}

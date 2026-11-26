import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/utils/supabase/server'

/**
 * Callback do OAuth (Google) do Supabase.
 * O Supabase redireciona para aqui com ?code=..., que é trocado por uma sessão
 * (guardada em cookies). Depois o utilizador volta para a aplicação.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  // Destino opcional (?next=/caminho). Só aceita caminhos internos para evitar open redirects.
  const nextParam = searchParams.get('next') ?? '/'
  const next = nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : '/'

  // Erro devolvido pelo próprio provider (ex.: utilizador cancelou o login no Google)
  const providerError = searchParams.get('error_description') ?? searchParams.get('error')
  if (providerError) {
    return redirectWithError(origin, providerError)
  }

  if (!code) {
    return redirectWithError(origin, 'Código de autenticação em falta')
  }

  try {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (error) {
      console.error('Erro ao trocar o código por sessão:', error.message)
      return redirectWithError(origin, error.message)
    }
  } catch (error) {
    console.error('Erro no callback de autenticação:', error)
    return redirectWithError(origin, 'Erro inesperado no login')
  }

  // Na Vercel, atrás do proxy, o host original vem em x-forwarded-host
  const forwardedHost = request.headers.get('x-forwarded-host')
  const isLocal = process.env.NODE_ENV === 'development'

  if (!isLocal && forwardedHost) {
    return NextResponse.redirect(`https://${forwardedHost}${next}`)
  }
  return NextResponse.redirect(`${origin}${next}`)
}

function redirectWithError(origin: string, message: string) {
  const url = new URL('/', origin)
  url.searchParams.set('auth_error', message)
  return NextResponse.redirect(url)
}

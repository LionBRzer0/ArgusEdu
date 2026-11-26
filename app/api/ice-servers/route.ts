import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

/**
 * Devolve os servidores ICE (STUN + TURN) para a partilha de ecrã por WebRTC.
 *
 * Só com STUN, a ligação funciona no mesmo computador ou na mesma rede, mas costuma falhar entre
 * redes diferentes (casa ↔ escola, dados móveis, redes de escola com firewall). O TURN
 * reencaminha o vídeo nesses casos.
 *
 * Configure UMA das opções nas variáveis de ambiente da Vercel (não são públicas):
 *   a) Metered (https://www.metered.ca/stun-turn, plano gratuito):
 *        METERED_DOMAIN=<a-sua-app>.metered.live
 *        METERED_API_KEY=<chave da API>
 *   b) Qualquer servidor TURN com credenciais fixas (ex.: coturn próprio):
 *        TURN_URLS=turn:turn.exemplo.com:3478,turns:turn.exemplo.com:5349
 *        TURN_USERNAME=...
 *        TURN_CREDENTIAL=...
 */

const STUN: RTCIceServer[] = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }]

export const dynamic = 'force-dynamic'

export async function GET() {
  // Só utilizadores com sessão iniciada recebem credenciais TURN (evita abuso da quota)
  try {
    const supabase = await createClient()
    const { data } = await supabase.auth.getUser()
    if (!data.user) return NextResponse.json({ iceServers: STUN, turn: false }, { status: 401 })
  } catch {
    return NextResponse.json({ iceServers: STUN, turn: false })
  }

  const turn = await loadTurnServers()
  return NextResponse.json(
    { iceServers: [...STUN, ...turn], turn: turn.length > 0 },
    { headers: { 'Cache-Control': 'private, no-store' } },
  )
}

async function loadTurnServers(): Promise<RTCIceServer[]> {
  const meteredDomain = process.env.METERED_DOMAIN
  const meteredKey = process.env.METERED_API_KEY
  if (meteredDomain && meteredKey) {
    try {
      const res = await fetch(
        `https://${meteredDomain}/api/v1/turn/credentials?apiKey=${encodeURIComponent(meteredKey)}`,
        { cache: 'no-store' },
      )
      if (res.ok) {
        const servers = (await res.json()) as RTCIceServer[]
        if (Array.isArray(servers)) return servers
      } else {
        console.error('Metered TURN respondeu', res.status)
      }
    } catch (error) {
      console.error('Não foi possível obter credenciais TURN da Metered', error)
    }
  }

  const urls = process.env.TURN_URLS?.split(',').map((u) => u.trim()).filter(Boolean)
  if (urls?.length) {
    return [{ urls, username: process.env.TURN_USERNAME, credential: process.env.TURN_CREDENTIAL }]
  }

  return []
}

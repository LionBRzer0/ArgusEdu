import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js"

/**
 * Canais privados: só ouve/envia quem as regras de `realtime-privado.sql` autorizarem.
 * Ative com NEXT_PUBLIC_REALTIME_PRIVATE=true (depois de executar esse script no Supabase).
 */
export const REALTIME_PRIVATE = process.env.NEXT_PUBLIC_REALTIME_PRIVATE === "true"

/**
 * Abre um canal de Broadcast.
 * O Supabase devolve o MESMO canal se já houver um com o nome igual (e fecha canais de forma assíncrona),
 * o que no modo estrito do React duplicava os ouvintes. Por isso fechamos primeiro qualquer canal antigo.
 */
export async function openBroadcastChannel(supabase: SupabaseClient, topic: string): Promise<RealtimeChannel> {
  const stale = supabase.getChannels().find((c) => c.topic === `realtime:${topic}`)
  if (stale) await supabase.removeChannel(stale)
  if (REALTIME_PRIVATE) await supabase.realtime.setAuth() // envia o token do utilizador antes de subscrever
  return supabase.channel(topic, { config: { private: REALTIME_PRIVATE, broadcast: { self: false } } })
}

import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js"
import { openBroadcastChannel } from "@/lib/realtime-channel"

/**
 * Sinalização WebRTC por Supabase Realtime (Broadcast).
 *
 * Há um canal por aluno: `sala-ao-vivo:<turmaId>:<alunoId>`. Assim as mensagens de um aluno
 * não chegam aos outros. O aluno (que tem o vídeo) cria a "offer"; o professor responde com a "answer".
 *
 *   professor → aluno : watch      "quero ver o teu ecrã"
 *   aluno → professor : sharing    "comecei a partilhar" (o professor volta a enviar `watch`)
 *   aluno → professor : offer
 *   professor → aluno : answer
 *   ambos             : candidate  (ICE)
 *   aluno → professor : stopped    "parei de partilhar"
 */
export type Signal =
  | { type: "watch"; viewerId: string }
  | { type: "sharing" }
  | { type: "stopped" }
  | { type: "offer"; viewerId: string; sdp: RTCSessionDescriptionInit }
  | { type: "answer"; viewerId: string; sdp: RTCSessionDescriptionInit }
  | { type: "candidate"; viewerId: string; from: "student" | "teacher"; candidate: RTCIceCandidateInit }

export const SIGNAL_EVENT = "signal"

/** STUN público: chega no mesmo computador/rede, mas não entre redes diferentes (aí é preciso TURN). */
export const DEFAULT_ICE_SERVERS: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }]

let iceCache: { servers: RTCIceServer[]; at: number } | null = null
const ICE_TTL_MS = 30 * 60 * 1000 // as credenciais TURN podem expirar; renova a cada 30 min

/**
 * Servidores ICE (STUN + TURN) vindos de `/api/ice-servers`, onde o TURN é configurado.
 * Se a rota falhar, usa só o STUN.
 */
export async function getIceServers(): Promise<RTCIceServer[]> {
  if (iceCache && Date.now() - iceCache.at < ICE_TTL_MS) return iceCache.servers
  try {
    const res = await fetch("/api/ice-servers", { cache: "no-store" })
    const data = (await res.json()) as { iceServers?: RTCIceServer[]; turn?: boolean }
    if (Array.isArray(data.iceServers) && data.iceServers.length > 0) {
      if (!data.turn) console.warn("Partilha de ecrã sem servidor TURN: pode falhar entre redes diferentes.")
      iceCache = { servers: data.iceServers, at: Date.now() }
      return data.iceServers
    }
  } catch (error) {
    console.warn("Não foi possível obter os servidores ICE; a usar só STUN", error)
  }
  return DEFAULT_ICE_SERVERS
}

/** `crypto.randomUUID` só existe em HTTPS/localhost; isto funciona em qualquer lado. */
export function newId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

/** Abre o canal de sinalização de um aluno (ver `openBroadcastChannel`). */
export function openSignalChannel(supabase: SupabaseClient, turmaId: string, alunoId: string): Promise<RealtimeChannel> {
  return openBroadcastChannel(supabase, `sala-ao-vivo:${turmaId}:${alunoId}`)
}

export function sendSignal(channel: RealtimeChannel | null, payload: Signal) {
  void channel?.send({ type: "broadcast", event: SIGNAL_EVENT, payload })
}

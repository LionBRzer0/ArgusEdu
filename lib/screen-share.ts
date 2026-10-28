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

/**
 * STUN público. Em redes de escola muito restritas pode ser preciso um servidor TURN
 * (passe-o na prop `iceServers` dos componentes).
 */
export const DEFAULT_ICE_SERVERS: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }]

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

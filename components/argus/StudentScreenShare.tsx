"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { RealtimeChannel } from "@supabase/supabase-js"
import { MonitorOff, MonitorUp } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DEFAULT_ICE_SERVERS,
  SIGNAL_EVENT,
  openSignalChannel,
  sendSignal,
  type Signal,
} from "@/lib/screen-share"
import { cn } from "@/lib/utils"
import { createClient } from "@/utils/supabase/client"

type StudentScreenShareProps = {
  turmaId: string
  alunoId: string
  /** Use para passar um servidor TURN se o STUN por omissão não chegar. */
  iceServers?: RTCIceServer[]
  /** Chamado quando o aluno começa/pára de partilhar (por ex. para avisar o professor). */
  onSharingChange?: (sharing: boolean) => void
  className?: string
}

/**
 * Ecrã do aluno: o botão "Partilhar Ecrã" pede o ecrã ao navegador (getDisplayMedia)
 * e envia-o por WebRTC a cada professor que o peça. A sinalização vai pelo Supabase Realtime.
 */
export function StudentScreenShare({ turmaId, alunoId, iceServers = DEFAULT_ICE_SERVERS, onSharingChange, className }: StudentScreenShareProps) {
  const supabase = useMemo(() => createClient(), [])
  const [connected, setConnected] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [viewers, setViewers] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [channelError, setChannelError] = useState(false)

  const channelRef = useRef<RealtimeChannel | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const peersRef = useRef(new Map<string, RTCPeerConnection>()) // um por professor que está a ver
  const pendingRef = useRef(new Map<string, RTCIceCandidateInit[]>()) // candidatos que chegaram cedo demais
  const iceRef = useRef(iceServers)
  const sharingCallbackRef = useRef(onSharingChange)
  const firstRun = useRef(true)
  useEffect(() => {
    iceRef.current = iceServers
    sharingCallbackRef.current = onSharingChange
  })

  // Avisa quem usa o componente quando o estado da partilha muda (não no arranque)
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false
      return
    }
    sharingCallbackRef.current?.(sharing)
  }, [sharing])

  const send = useCallback((payload: Signal) => sendSignal(channelRef.current, payload), [])

  const refreshViewers = useCallback(() => {
    let count = 0
    peersRef.current.forEach((pc) => {
      if (pc.connectionState === "connected") count++
    })
    setViewers(count)
  }, [])

  const closePeer = useCallback(
    (viewerId: string) => {
      peersRef.current.get(viewerId)?.close()
      peersRef.current.delete(viewerId)
      pendingRef.current.delete(viewerId)
      refreshViewers()
    },
    [refreshViewers],
  )

  /** Um professor pediu para ver: criamos uma ligação só para ele e enviamos a offer. */
  const connectViewer = useCallback(
    async (viewerId: string) => {
      const stream = streamRef.current
      if (!stream) return // ainda não estou a partilhar; o `sharing` avisará quando começar

      closePeer(viewerId)
      const pc = new RTCPeerConnection({ iceServers: iceRef.current })
      peersRef.current.set(viewerId, pc)
      stream.getTracks().forEach((track) => pc.addTrack(track, stream))

      pc.onicecandidate = (event) => {
        if (event.candidate) send({ type: "candidate", viewerId, from: "student", candidate: event.candidate.toJSON() })
      }
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "failed" || pc.connectionState === "closed") {
          if (peersRef.current.get(viewerId) === pc) closePeer(viewerId)
        }
        refreshViewers()
      }

      try {
        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        send({ type: "offer", viewerId, sdp: { type: offer.type, sdp: offer.sdp } })
      } catch (err) {
        console.error("Falha ao criar a offer", err)
        closePeer(viewerId)
      }
    },
    [closePeer, refreshViewers, send],
  )

  const handleSignal = useCallback(
    async (msg: Signal) => {
      if (msg.type === "watch") {
        await connectViewer(msg.viewerId)
        return
      }

      const pc = "viewerId" in msg ? peersRef.current.get(msg.viewerId) : undefined
      if (!pc) return

      try {
        if (msg.type === "answer") {
          await pc.setRemoteDescription(msg.sdp)
          const queued = pendingRef.current.get(msg.viewerId) ?? []
          pendingRef.current.delete(msg.viewerId)
          for (const candidate of queued) await pc.addIceCandidate(candidate)
        } else if (msg.type === "candidate" && msg.from === "teacher") {
          if (pc.remoteDescription) {
            await pc.addIceCandidate(msg.candidate)
          } else {
            const queue = pendingRef.current.get(msg.viewerId) ?? []
            queue.push(msg.candidate)
            pendingRef.current.set(msg.viewerId, queue)
          }
        }
      } catch (err) {
        console.warn("Sinal WebRTC ignorado", err)
      }
    },
    [connectViewer],
  )

  const stop = useCallback(() => {
    const wasSharing = streamRef.current !== null
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    peersRef.current.forEach((pc) => pc.close())
    peersRef.current.clear()
    pendingRef.current.clear()
    setSharing(false)
    setViewers(0)
    if (wasSharing) send({ type: "stopped" })
  }, [send])

  // Liga ao canal de sinalização enquanto o componente estiver no ecrã
  useEffect(() => {
    let cancelled = false
    let channel: RealtimeChannel | null = null

    void (async () => {
      const opened = await openSignalChannel(supabase, turmaId, alunoId)
      if (cancelled) {
        void supabase.removeChannel(opened)
        return
      }
      channel = opened
      channelRef.current = opened
      opened
        .on("broadcast", { event: SIGNAL_EVENT }, ({ payload }) => void handleSignal(payload as Signal))
        .subscribe((status) => {
          if (cancelled) return
          setConnected(status === "SUBSCRIBED")
          setChannelError(status === "CHANNEL_ERROR" || status === "TIMED_OUT")
        })
    })()

    return () => {
      cancelled = true
      stop()
      channelRef.current = null
      setConnected(false)
      if (channel) void supabase.removeChannel(channel)
    }
  }, [supabase, turmaId, alunoId, handleSignal, stop])

  async function start() {
    setError(null)
    if (!navigator.mediaDevices?.getDisplayMedia) {
      setError("Este navegador não permite partilhar o ecrã. Use o Chrome, Edge ou Firefox no computador, em HTTPS.")
      return
    }
    try {
      // Poucas imagens por segundo: chega para monitorizar e poupa a rede da escola.
      // `displaySurface: "monitor"` e as restantes opções são dicas (Chrome/Edge): a lista abre no separador
      // "Ecrã inteiro", não deixa partilhar este separador nem trocar de janela a meio.
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: "monitor", frameRate: { ideal: 5, max: 10 } },
        audio: false,
        monitorTypeSurfaces: "include",
        selfBrowserSurface: "exclude",
        surfaceSwitching: "exclude",
        systemAudio: "exclude",
      } as DisplayMediaStreamOptions)

      // As dicas não obrigam, por isso confirmamos o que o aluno escolheu: "monitor" (ecrã inteiro),
      // "window" ou "browser" (separador). Navegadores que não dizem (ex.: Safari) ficam por verificar.
      const track = stream.getVideoTracks()[0]
      const surface = (track?.getSettings?.() as (MediaTrackSettings & { displaySurface?: string }) | undefined)?.displaySurface
      if (surface && surface !== "monitor") {
        stream.getTracks().forEach((t) => t.stop())
        setError("Tem de partilhar o «Ecrã inteiro», não uma janela nem um separador. Clique em Partilhar Ecrã e escolha o ecrã.")
        return
      }
      streamRef.current = stream
      // O aluno pode parar pela barra do próprio navegador ("Parar de partilhar")
      track?.addEventListener("ended", stop)
      setSharing(true)
      send({ type: "sharing" }) // o professor responde com `watch` e começa a negociação
    } catch (err) {
      const denied = err instanceof DOMException && (err.name === "NotAllowedError" || err.name === "AbortError")
      setError(denied ? "A partilha foi cancelada ou não foi permitida." : "Não foi possível iniciar a partilha de ecrã.")
    }
  }

  const badge = sharing ? (viewers > 0 ? `A transmitir · ${viewers} a ver` : "A partilhar") : connected ? "Parado" : "A ligar…"

  return (
    <section aria-labelledby="screen-share-title" className={cn("flex flex-col gap-4 rounded-xl border bg-card p-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 id="screen-share-title" className="text-sm font-semibold">
            Partilha de ecrã
          </h2>
          <p className="text-xs text-muted-foreground">
            {sharing ? "O professor consegue ver o seu ecrã." : "O professor só vê o seu ecrã depois de clicar em Partilhar."}
          </p>
        </div>
        <Badge variant="outline" className={cn("shrink-0 gap-1.5", sharing && "border-primary/30 text-primary")}>
          <span
            className={cn("size-1.5 rounded-full", sharing ? "animate-pulse bg-primary" : "bg-muted-foreground/50")}
            aria-hidden="true"
          />
          {badge}
        </Badge>
      </div>

      {sharing ? (
        <Button variant="destructive" onClick={stop} className="gap-2">
          <MonitorOff aria-hidden="true" />
          Parar partilha
        </Button>
      ) : (
        <Button onClick={start} disabled={!connected} className="gap-2">
          <MonitorUp aria-hidden="true" />
          Partilhar Ecrã
        </Button>
      )}

      {!sharing && !error && !channelError && (
        <p className="text-xs text-muted-foreground">Na janela do navegador, escolha «Ecrã inteiro» e confirme.</p>
      )}

      {(error || channelError) && (
        <p role="alert" className="text-xs text-destructive">
          {error ?? "Não foi possível ligar ao canal da sala. Verifique a ligação à internet e recarregue a página."}
        </p>
      )}
    </section>
  )
}

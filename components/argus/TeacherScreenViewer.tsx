"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import type { RealtimeChannel } from "@supabase/supabase-js"
import { MonitorOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DEFAULT_ICE_SERVERS,
  SIGNAL_EVENT,
  newId,
  openSignalChannel,
  sendSignal,
  type Signal,
} from "@/lib/screen-share"
import { cn } from "@/lib/utils"
import { createClient } from "@/utils/supabase/client"

type ViewerState = "connecting" | "waiting" | "live" | "ended" | "failed"

type TeacherScreenViewerProps = {
  turmaId: string
  alunoId: string
  alunoNome?: string
  /** Use para passar um servidor TURN se o STUN por omissão não chegar. */
  iceServers?: RTCIceServer[]
  className?: string
}

const messages: Record<Exclude<ViewerState, "live">, string> = {
  connecting: "A ligar…",
  waiting: "À espera que o aluno partilhe o ecrã.",
  ended: "O aluno parou a partilha.",
  failed: "Não foi possível ligar ao ecrã do aluno.",
}

/**
 * Painel do professor: pede o ecrã de UM aluno e mostra-o em direto num <video>.
 * Use um destes por aluno e por página (o canal de sinalização é um por aluno).
 */
export function TeacherScreenViewer({
  turmaId,
  alunoId,
  alunoNome,
  iceServers = DEFAULT_ICE_SERVERS,
  className,
}: TeacherScreenViewerProps) {
  const supabase = useMemo(() => createClient(), [])
  const videoRef = useRef<HTMLVideoElement>(null)
  const requestRef = useRef<() => void>(() => {})
  const iceRef = useRef(iceServers)
  const [state, setState] = useState<ViewerState>("connecting")

  useEffect(() => {
    iceRef.current = iceServers
  })

  useEffect(() => {
    let cancelled = false
    let channel: RealtimeChannel | null = null
    let pc: RTCPeerConnection | null = null
    let pending: RTCIceCandidateInit[] = [] // candidatos que chegaram antes de a offer estar aplicada
    const viewerId = newId() // identifica este painel perante o aluno

    const send = (payload: Signal) => sendSignal(channel, payload)

    function closePeer() {
      pc?.close()
      pc = null
      pending = []
      if (videoRef.current) videoRef.current.srcObject = null
    }

    /** Pede ao aluno que (re)inicie a ligação. */
    function requestStream() {
      closePeer()
      setState("waiting")
      send({ type: "watch", viewerId })
    }
    requestRef.current = requestStream

    async function handleOffer(sdp: RTCSessionDescriptionInit) {
      closePeer()
      const peer = new RTCPeerConnection({ iceServers: iceRef.current })
      pc = peer
      setState("connecting")

      peer.onicecandidate = (event) => {
        if (event.candidate) send({ type: "candidate", viewerId, from: "teacher", candidate: event.candidate.toJSON() })
      }
      peer.ontrack = (event) => {
        if (videoRef.current) videoRef.current.srcObject = event.streams[0] ?? new MediaStream([event.track])
      }
      peer.onconnectionstatechange = () => {
        if (pc !== peer) return
        if (peer.connectionState === "connected") setState("live")
        else if (peer.connectionState === "failed") setState("failed")
        else if (peer.connectionState === "disconnected") setState("connecting")
      }

      try {
        await peer.setRemoteDescription(sdp)
        for (const candidate of pending) await peer.addIceCandidate(candidate)
        pending = []
        const answer = await peer.createAnswer()
        await peer.setLocalDescription(answer)
        send({ type: "answer", viewerId, sdp: { type: answer.type, sdp: answer.sdp } })
      } catch (err) {
        console.error("Falha ao responder à offer", err)
        if (pc === peer) setState("failed")
      }
    }

    async function handleSignal(msg: Signal) {
      if (msg.type === "sharing") {
        requestStream() // o aluno acabou de começar a partilhar
      } else if (msg.type === "stopped") {
        closePeer()
        setState("ended")
      } else if (msg.type === "offer" && msg.viewerId === viewerId) {
        await handleOffer(msg.sdp)
      } else if (msg.type === "candidate" && msg.viewerId === viewerId && msg.from === "student") {
        try {
          if (pc?.remoteDescription) await pc.addIceCandidate(msg.candidate)
          else pending.push(msg.candidate)
        } catch (err) {
          console.warn("Candidato ICE ignorado", err)
        }
      }
    }

    void (async () => {
      const opened = await openSignalChannel(supabase, turmaId, alunoId)
      if (cancelled) {
        void supabase.removeChannel(opened)
        return
      }
      channel = opened
      opened
        .on("broadcast", { event: SIGNAL_EVENT }, ({ payload }) => void handleSignal(payload as Signal))
        .subscribe((status) => {
          // Canal pronto (ou religado): pede o ecrã, caso o aluno já esteja a partilhar
          if (cancelled) return
          if (status === "SUBSCRIBED") requestStream()
          else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") setState("failed")
        })
    })()

    return () => {
      cancelled = true
      closePeer()
      requestRef.current = () => {}
      if (channel) void supabase.removeChannel(channel)
    }
  }, [supabase, turmaId, alunoId])

  const live = state === "live"
  const label = alunoNome ?? "aluno"

  return (
    <div className={cn("relative aspect-video overflow-hidden rounded-lg border bg-black", className)}>
      {/* muted: os navegadores só deixam o vídeo arrancar sozinho se não tiver som */}
      <video ref={videoRef} autoPlay playsInline muted aria-label={`Ecrã de ${label} em direto`} className="size-full object-contain" />

      {live ? (
        <span className="absolute left-2 top-2 flex items-center gap-1.5 rounded bg-background/80 px-1.5 py-0.5 font-mono text-[10px] font-medium text-primary backdrop-blur">
          <span className="size-1.5 animate-pulse rounded-full bg-primary" aria-hidden="true" />
          AO VIVO
        </span>
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-muted p-4 text-center text-muted-foreground">
          <MonitorOff className="size-6" aria-hidden="true" />
          <p role="status" className="text-xs">
            {messages[state as Exclude<ViewerState, "live">]}
          </p>
          {state !== "connecting" && (
            <Button variant="outline" size="sm" onClick={() => requestRef.current()}>
              Pedir ligação
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

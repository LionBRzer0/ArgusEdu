"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import type { RealtimeChannel, User } from "@supabase/supabase-js"
import { ExternalLink, Lock, LogOut, Monitor, Radio, Users } from "lucide-react"
import { toast } from "sonner"
import { BrandMark } from "@/components/argus/brand"
import { StudentScreenShare } from "@/components/argus/StudentScreenShare"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import type { StudentSession } from "@/lib/classroom-data"
import { setSharing } from "@/lib/classroom-db"
import { ALL_STUDENTS, COMMAND_EVENT, commandTopic, parseEnvelope, type Command } from "@/lib/commands"
import { openBroadcastChannel } from "@/lib/realtime-channel"
import { createClient } from "@/utils/supabase/client"

export type EndReason = "ended" | "removed"

type StudentWaitingProps = {
  session: StudentSession
  user: User | null
  onLogout: () => void
  /** O professor encerrou a sessão ou removeu este aluno. */
  onEnded: (reason: EndReason) => void
}

function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("")
}

export function StudentWaiting({ session, user, onLogout, onEnded }: StudentWaitingProps) {
  const supabase = useMemo(() => createClient(), [])
  const avatarUrl = typeof user?.user_metadata?.avatar_url === "string" ? user.user_metadata.avatar_url : undefined

  const [locked, setLocked] = useState(session.locked)
  const [link, setLink] = useState<string | null>(null)
  const endedRef = useRef(onEnded)
  useEffect(() => {
    endedRef.current = onEnded
  })

  // Escuta os comandos do professor e reage na hora
  useEffect(() => {
    let cancelled = false
    let channel: RealtimeChannel | null = null

    function handleCommand(command: Command) {
      switch (command.type) {
        case "LOCK_SCREEN":
          setLocked(true)
          break
        case "UNLOCK_SCREEN":
          setLocked(false)
          break
        case "NAVIGATE_TO": {
          // Se o navegador deixar, abre logo; senão fica um botão para o aluno abrir
          const win = window.open(command.url, "_blank")
          if (win) {
            win.opener = null
            toast.info("O professor abriu um link no seu navegador", { description: command.url })
          } else {
            setLink(command.url)
          }
          break
        }
        case "MESSAGE":
          toast.warning("Mensagem do professor", { description: command.text, duration: 20000 })
          break
        case "END_SESSION":
          endedRef.current("ended")
          break
        case "REMOVE_STUDENT":
          endedRef.current("removed")
          break
      }
    }

    void (async () => {
      const opened = await openBroadcastChannel(supabase, commandTopic(session.turmaId))
      if (cancelled) {
        void supabase.removeChannel(opened)
        return
      }
      channel = opened
      opened
        .on("broadcast", { event: COMMAND_EVENT }, ({ payload }) => {
          const envelope = parseEnvelope(payload)
          if (!envelope) return
          if (envelope.to !== ALL_STUDENTS && envelope.to !== session.studentId) return
          handleCommand(envelope.command)
        })
        .subscribe()
    })()

    return () => {
      cancelled = true
      if (channel) void supabase.removeChannel(channel)
    }
  }, [supabase, session.turmaId, session.studentId])

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 p-6">
      <BrandMark />
      <section
        aria-labelledby="waiting-title"
        className="w-full max-w-md overflow-hidden rounded-2xl border bg-card shadow-2xl shadow-black/20"
      >
        <div className="flex flex-col items-center gap-5 px-6 pb-6 pt-10 text-center">
          <div className="relative flex size-20 items-center justify-center" aria-hidden="true">
            <span className="absolute inset-0 animate-ping rounded-full bg-primary/15 [animation-duration:2.4s]" />
            <span className="absolute inset-3 rounded-full border border-primary/30" />
            <span className="relative flex size-12 items-center justify-center rounded-full bg-primary/15 text-primary">
              <Radio className="size-6" />
            </span>
          </div>
          <div className="flex flex-col gap-1.5">
            <h1 id="waiting-title" className="text-lg font-semibold tracking-tight">
              Ligado à sala {session.turmaName}
            </h1>
            <p className="text-pretty text-sm text-muted-foreground">
              Partilhe o seu ecrã para o professor poder acompanhar o seu trabalho. Mantenha esta janela aberta.
            </p>
          </div>
          <Badge variant="outline" className="gap-1.5 border-primary/30 text-primary">
            <span className="size-1.5 animate-pulse rounded-full bg-primary" aria-hidden="true" />
            Pronto para ligar
          </Badge>
        </div>

        <Separator />

        <div className="flex flex-col gap-4 p-6">
          {link && (
            <div role="alert" className="flex flex-col gap-2 rounded-lg border border-primary/40 bg-primary/10 p-3 text-sm">
              <span className="font-medium">O professor enviou-lhe um link</span>
              <span className="break-all font-mono text-xs text-muted-foreground">{link}</span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="gap-1.5"
                  onClick={() => {
                    const win = window.open(link, "_blank")
                    if (win) win.opener = null
                    setLink(null)
                  }}
                >
                  <ExternalLink aria-hidden="true" />
                  Abrir link
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setLink(null)}>
                  Dispensar
                </Button>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3">
            <Avatar className="size-11 ring-2 ring-primary/30">
              {avatarUrl && <AvatarImage src={avatarUrl} alt={`Foto de ${session.name}`} />}
              <AvatarFallback>{initialsOf(session.name)}</AvatarFallback>
            </Avatar>
            <div className="flex min-w-0 flex-1 flex-col leading-tight">
              <span className="truncate text-sm font-medium">{session.name}</span>
              {user?.email && <span className="truncate text-xs text-muted-foreground">{user.email}</span>}
            </div>
            <Badge variant="secondary" className="shrink-0 text-[10px]">
              Aluno
            </Badge>
          </div>

          <dl className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex flex-col gap-1 rounded-lg border bg-background/50 p-3">
              <dt className="flex items-center gap-1.5 text-muted-foreground">
                <Users className="size-3.5" aria-hidden="true" />
                Turma
              </dt>
              <dd className="truncate font-mono">{session.turmaName}</dd>
            </div>
            <div className="flex flex-col gap-1 rounded-lg border bg-background/50 p-3">
              <dt className="flex items-center gap-1.5 text-muted-foreground">
                <Monitor className="size-3.5" aria-hidden="true" />
                Mesa
              </dt>
              <dd className="font-mono text-primary">{session.desk}</dd>
            </div>
          </dl>

          <StudentScreenShare
            turmaId={session.turmaId}
            alunoId={session.studentId}
            className="bg-background/50"
            onSharingChange={(active) => {
              void setSharing(supabase, active).catch((error) => console.error(error))
            }}
          />

          <Button variant="outline" onClick={onLogout} className="gap-2">
            <LogOut aria-hidden="true" />
            Terminar sessão
          </Button>
        </div>
      </section>

      {locked && (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="lock-title"
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-4 bg-background/95 p-6 text-center backdrop-blur-md"
        >
          <span className="flex size-16 items-center justify-center rounded-full bg-primary/15 text-primary">
            <Lock className="size-8" aria-hidden="true" />
          </span>
          <h2 id="lock-title" className="text-2xl font-semibold tracking-tight">
            Ecrã bloqueado
          </h2>
          <p className="max-w-sm text-pretty text-sm text-muted-foreground">
            O professor bloqueou o seu ecrã. Aguarde as instruções. A partilha de ecrã continua ativa.
          </p>
        </div>
      )}
    </main>
  )
}

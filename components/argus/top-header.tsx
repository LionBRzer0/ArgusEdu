"use client"

import { useEffect, useState } from "react"
import { Clock, Copy, FileLock2, PowerOff, ShieldCheck, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { ConfirmButton } from "@/components/argus/confirm-button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"

type TopHeaderProps = {
  sessionName: string
  roomCode: string
  sessionActive: boolean
  startedAt: string
  endedAt: string | null
  examMode: boolean
  onExamModeChange: (value: boolean) => void
  onEndSession: () => void
  onDelete: () => void
}

function formatDuration(totalSeconds: number) {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":")
}

function RoomCode({ code }: { code: string }) {
  async function copy() {
    try {
      await navigator.clipboard.writeText(code)
      toast.success("Código da sala copiado")
    } catch {
      toast.error("Não foi possível copiar. Selecione o código e copie à mão.")
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={`Código da sala ${code}. Clique para copiar`}
      className="flex items-center gap-2.5 rounded-lg border bg-card px-3 py-1.5 text-left transition-colors hover:border-primary/40"
    >
      <span className="flex flex-col leading-tight">
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Código da sala</span>
        <span className="font-mono text-sm font-semibold tracking-[0.15em] text-primary">{code}</span>
      </span>
      <Copy className="size-3.5 text-muted-foreground" aria-hidden="true" />
    </button>
  )
}

function SessionTimer({ running, startedAt, endedAt }: { running: boolean; startedAt: string; endedAt: string | null }) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!running) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [running])

  const end = running ? now : endedAt ? new Date(endedAt).getTime() : now
  const seconds = Math.max(0, Math.floor((end - new Date(startedAt).getTime()) / 1000))

  return (
    <div className="flex items-center gap-2.5 rounded-lg border bg-card px-3 py-1.5">
      <span className="relative flex size-2">
        {running && <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-60" />}
        <span className={cn("relative inline-flex size-2 rounded-full", running ? "bg-primary" : "bg-muted-foreground")} />
      </span>
      <div className="flex flex-col leading-tight">
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          {running ? "Sessão ativa" : "Sessão encerrada"}
        </span>
        <span className="flex items-center gap-1 font-mono text-sm tabular-nums">
          <Clock className="size-3 text-muted-foreground" aria-hidden="true" />
          <time aria-live="off">{formatDuration(seconds)}</time>
        </span>
      </div>
    </div>
  )
}

export function TopHeader({
  sessionName,
  roomCode,
  sessionActive,
  startedAt,
  endedAt,
  examMode,
  onExamModeChange,
  onEndSession,
  onDelete,
}: TopHeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur-xl">
      <div className="flex h-16 items-center gap-4 px-4 lg:px-6">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-primary">
            <ShieldCheck className="size-5" aria-hidden="true" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-base font-semibold tracking-tight">ArgusEdu</span>
            <span className="hidden max-w-48 truncate text-[11px] text-muted-foreground sm:block">{sessionName}</span>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-3">
          <RoomCode code={roomCode} />
          <SessionTimer running={sessionActive} startedAt={startedAt} endedAt={endedAt} />

          <label
            className={cn(
              "flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 transition-colors",
              examMode ? "border-primary/40 bg-primary/10" : "bg-card",
            )}
          >
            <FileLock2 className={cn("size-4", examMode ? "text-primary" : "text-muted-foreground")} aria-hidden="true" />
            <span className="hidden text-sm font-medium md:inline">Modo Prova</span>
            <Switch checked={examMode} onCheckedChange={onExamModeChange} disabled={!sessionActive} aria-label="Modo Prova" />
          </label>

          <Button variant="destructive" onClick={onEndSession} disabled={!sessionActive} className="h-9 gap-2 px-3">
            <PowerOff aria-hidden="true" />
            <span className="hidden lg:inline">Encerrar Sessão (Desconectar Todos)</span>
            <span className="lg:hidden">Encerrar</span>
          </Button>

          <ConfirmButton
            variant="ghost"
            onConfirm={onDelete}
            confirmLabel="Apagar?"
            className="h-9 gap-2 px-3 text-muted-foreground"
            aria-label="Apagar esta turma"
          >
            <Trash2 aria-hidden="true" />
            <span className="hidden 2xl:inline">Apagar turma</span>
          </ConfirmButton>

          <Separator orientation="vertical" className="mx-1 h-8" />

          <div className="flex items-center gap-2.5">
            <Avatar className="size-9 ring-2 ring-primary/30">
              <AvatarImage src="/prof-silva.png" alt="Foto de Prof. Silva" />
              <AvatarFallback>PS</AvatarFallback>
            </Avatar>
            <div className="hidden flex-col leading-tight xl:flex">
              <span className="text-sm font-medium">Prof. Silva</span>
              <Badge variant="outline" className="h-4 border-primary/30 px-1.5 text-[10px] text-primary">
                Professor
              </Badge>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}

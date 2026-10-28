"use client"

import Image from "next/image"
import { AlertTriangle, Eye, Lock, LockOpen, MonitorOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { Student } from "@/lib/classroom-data"
import { cn } from "@/lib/utils"

type DeskCardProps = {
  student: Student
  selected: boolean
  onOpen: () => void
  onToggleLock: () => void
}

const statusLabel = {
  online: "Online",
  alert: "Alerta",
  offline: "Offline",
} as const

export function StatusDot({ status, className }: { status: Student["status"]; className?: string }) {
  return (
    <span className={cn("relative flex size-2", className)}>
      {status !== "offline" && (
        <span
          className={cn(
            "absolute inline-flex size-full animate-ping rounded-full opacity-50",
            status === "alert" ? "bg-destructive" : "bg-primary",
          )}
        />
      )}
      <span
        className={cn(
          "relative inline-flex size-2 rounded-full",
          status === "online" && "bg-primary",
          status === "alert" && "bg-destructive",
          status === "offline" && "bg-muted-foreground/50",
        )}
      />
      <span className="sr-only">{statusLabel[status]}</span>
    </span>
  )
}

export function DeskCard({ student, selected, onOpen, onToggleLock }: DeskCardProps) {
  const isOffline = student.status === "offline"
  const isAlert = student.status === "alert"

  return (
    <article
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-xl border bg-card transition-all",
        "hover:border-foreground/20 hover:shadow-lg hover:shadow-black/30",
        isAlert && "border-destructive/50 shadow-lg shadow-destructive/10 hover:border-destructive/70",
        selected && "ring-2 ring-primary",
        isOffline && "opacity-60",
      )}
    >
      <button
        type="button"
        onClick={onOpen}
        className="flex flex-col text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
        aria-label={`Abrir detalhes de ${student.name}, mesa ${student.desk}, status ${statusLabel[student.status]}`}
      >
        <div className="relative aspect-video w-full overflow-hidden border-b bg-muted">
          {isOffline ? (
            <div className="flex size-full flex-col items-center justify-center gap-1.5 text-muted-foreground">
              <MonitorOff className="size-5" aria-hidden="true" />
              <span className="text-[11px]">Sem sinal</span>
            </div>
          ) : (
            <>
              <Image
                src={student.screen || "/placeholder.svg"}
                alt={`Prévia da tela de ${student.name}`}
                fill
                sizes="(min-width: 1536px) 18vw, (min-width: 1024px) 22vw, 45vw"
                className={cn(
                  "object-cover object-top transition-transform duration-500 group-hover:scale-[1.03]",
                  student.locked && "blur-sm brightness-50",
                )}
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 h-1/3 bg-gradient-to-b from-transparent via-white/5 to-transparent [animation:scan_4s_linear_infinite]"
              />
              {student.locked && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="flex items-center gap-1.5 rounded-md bg-background/80 px-2 py-1 text-[11px] font-medium backdrop-blur">
                    <Lock className="size-3" aria-hidden="true" /> Bloqueado
                  </span>
                </div>
              )}
              {isAlert && !student.locked && (
                <div className="absolute inset-x-0 bottom-0 flex items-center gap-1.5 bg-destructive/90 px-2 py-1 text-[11px] font-medium text-white">
                  <AlertTriangle className="size-3 shrink-0" aria-hidden="true" />
                  <span className="truncate">{student.alertReason}</span>
                </div>
              )}
            </>
          )}
          <span className="absolute top-1.5 left-1.5 rounded bg-background/80 px-1.5 py-0.5 font-mono text-[10px] font-medium backdrop-blur">
            {student.desk}
          </span>
        </div>

        <div className="flex flex-col gap-1 px-3 pt-2.5">
          <div className="flex items-center gap-2">
            <StatusDot status={student.status} />
            <h3 className="truncate text-sm font-medium">{student.name}</h3>
          </div>
          <p className="truncate font-mono text-[11px] text-muted-foreground" title={student.activeWindow}>
            {student.activeWindow}
          </p>
        </div>
      </button>

      <div className="flex items-center justify-end gap-1 px-2 pt-1 pb-2">
        <Tooltip>
          <TooltipTrigger
            render={
              <Button variant="ghost" size="icon-sm" onClick={onOpen} disabled={isOffline} aria-label={`Ver tela de ${student.name}`}>
                <Eye />
              </Button>
            }
          />
          <TooltipContent>Ver tela</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={onToggleLock}
                disabled={isOffline}
                aria-pressed={student.locked}
                aria-label={student.locked ? `Desbloquear ${student.name}` : `Bloquear ${student.name}`}
                className={cn(student.locked && "text-destructive hover:text-destructive")}
              >
                {student.locked ? <Lock /> : <LockOpen />}
              </Button>
            }
          />
          <TooltipContent>{student.locked ? "Desbloquear" : "Bloquear"}</TooltipContent>
        </Tooltip>
      </div>
    </article>
  )
}

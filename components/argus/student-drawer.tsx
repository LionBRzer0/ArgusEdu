"use client"

import { useState } from "react"
import { AlertTriangle, ExternalLink, Lock, LockOpen, Maximize2, Send, UserMinus, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { StatusDot } from "@/components/argus/desk-card"
import { TeacherScreenViewer } from "@/components/argus/TeacherScreenViewer"
import type { Student } from "@/lib/classroom-data"
import { cn } from "@/lib/utils"

type StudentDrawerProps = {
  turmaId: string
  student: Student | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onToggleLock: (id: string) => void
  onSendMessage: (id: string, message: string) => void
  /** Devolve true se o link foi enviado. */
  onSendLink: (id: string, url: string) => Promise<boolean>
  onRemove: (id: string) => void
}

const quickMessages = ["O tempo está quase acabando!", "Foque na atividade.", "Faltam 10 minutos."]

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h3 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{children}</h3>
}

export function StudentDrawer({
  turmaId,
  student,
  open,
  onOpenChange,
  onToggleLock,
  onSendMessage,
  onSendLink,
  onRemove,
}: StudentDrawerProps) {
  const [message, setMessage] = useState("")
  const [link, setLink] = useState("")

  function submitMessage() {
    if (!student || !message.trim()) return
    onSendMessage(student.id, message.trim())
    setMessage("")
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" showCloseButton={false} className="w-full gap-0 p-0 sm:max-w-lg data-[side=right]:sm:max-w-lg">
        {student && (
          <>
            <SheetHeader className="flex-row items-start justify-between gap-3 border-b p-5">
              <div className="flex min-w-0 flex-col gap-1">
                <div className="flex items-center gap-2">
                  <StatusDot status={student.status} />
                  <SheetTitle className="truncate text-base">{student.name}</SheetTitle>
                  <Badge variant="outline" className="font-mono text-[10px]">
                    {student.desk}
                  </Badge>
                </div>
                <SheetDescription className="truncate font-mono text-xs">{student.activeWindow}</SheetDescription>
              </div>
              <Button variant="ghost" size="icon-sm" onClick={() => onOpenChange(false)} aria-label="Fechar painel">
                <X />
              </Button>
            </SheetHeader>

            <ScrollArea className="min-h-0 flex-1">
              <div className="flex flex-col gap-6 p-5">
                <div className="flex flex-col gap-3">
                  <SectionLabel>Tela ao vivo</SectionLabel>
                  <div className="relative">
                    <TeacherScreenViewer
                      key={student.id}
                      turmaId={turmaId}
                      alunoId={student.id}
                      alunoNome={student.name}
                      className={cn(student.locked && "blur-sm brightness-50")}
                    />
                    {student.locked && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="flex items-center gap-1.5 rounded-md bg-background/80 px-2.5 py-1 text-xs font-medium backdrop-blur">
                          <Lock className="size-3.5" aria-hidden="true" /> Tela bloqueada
                        </span>
                      </div>
                    )}
                    <Button
                      variant="secondary"
                      size="icon-sm"
                      className="absolute right-2 bottom-2 bg-background/70 backdrop-blur"
                      aria-label="Tela cheia"
                    >
                      <Maximize2 />
                    </Button>
                  </div>
                  {student.status === "alert" && (
                    <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                      <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
                      {student.alertReason}
                    </div>
                  )}
                </div>

                <Button
                  variant={student.locked ? "secondary" : "outline"}
                  className="h-auto justify-start gap-2 p-3"
                  onClick={() => onToggleLock(student.id)}
                  aria-pressed={student.locked}
                >
                  {student.locked ? <LockOpen /> : <Lock />}
                  {student.locked ? "Desbloquear ecrã do ArgusEdu" : "Bloquear ecrã do ArgusEdu"}
                </Button>

                <div className="flex flex-col gap-3">
                  <SectionLabel>Abrir link no navegador do aluno</SectionLabel>
                  <form
                    className="flex gap-2"
                    onSubmit={async (e) => {
                      e.preventDefault()
                      if (!link.trim()) return
                      if (await onSendLink(student.id, link.trim())) setLink("")
                    }}
                  >
                    <Input
                      value={link}
                      onChange={(e) => setLink(e.target.value)}
                      placeholder="Ex.: escola.pt/prova"
                      aria-label="Endereço a abrir no navegador do aluno"
                      inputMode="url"
                      autoComplete="off"
                      className="h-9"
                    />
                    <Button type="submit" className="h-9 gap-1.5" disabled={!link.trim()}>
                      <ExternalLink aria-hidden="true" />
                      Enviar
                    </Button>
                  </form>
                </div>

                <div className="flex flex-col gap-3">
                  <SectionLabel>Enviar mensagem de alerta</SectionLabel>
                  <form
                    className="flex gap-2"
                    onSubmit={(e) => {
                      e.preventDefault()
                      submitMessage()
                    }}
                  >
                    <Input
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Ex.: O tempo está quase acabando!"
                      aria-label="Mensagem de alerta"
                      className="h-9"
                      maxLength={140}
                    />
                    <Button type="submit" className="h-9 gap-1.5" disabled={!message.trim()}>
                      <Send aria-hidden="true" />
                      Enviar
                    </Button>
                  </form>
                  <div className="flex flex-wrap gap-1.5">
                    {quickMessages.map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => setMessage(q)}
                        className="rounded-full border bg-card px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </ScrollArea>

            <div className="border-t p-5">
              <Separator className="sr-only" />
              <Button
                variant="outline"
                className="w-full gap-2 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => onRemove(student.id)}
              >
                <UserMinus aria-hidden="true" />
                Remover do Monitoramento
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

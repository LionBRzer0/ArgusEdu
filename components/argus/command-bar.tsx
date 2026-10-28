"use client"

import { useState, type FormEvent } from "react"
import { ExternalLink, Lock, LockOpen, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type CommandBarProps = {
  disabled: boolean
  onLockAll: (locked: boolean) => void
  /** Devolve true se o link foi enviado (o campo é limpo). */
  onSendLink: (url: string) => Promise<boolean>
  onSendMessage: (text: string) => void
}

/** Comandos para TODA a turma: bloquear/desbloquear, enviar um link e avisar. */
export function CommandBar({ disabled, onLockAll, onSendLink, onSendMessage }: CommandBarProps) {
  const [url, setUrl] = useState("")
  const [text, setText] = useState("")

  async function submitLink(e: FormEvent) {
    e.preventDefault()
    if (!url.trim()) return
    if (await onSendLink(url.trim())) setUrl("")
  }

  function submitMessage(e: FormEvent) {
    e.preventDefault()
    if (!text.trim()) return
    onSendMessage(text.trim())
    setText("")
  }

  return (
    <section aria-label="Comandos para toda a turma" className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border bg-card p-3">
      <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Toda a turma</span>

      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="gap-1.5" disabled={disabled} onClick={() => onLockAll(true)}>
          <Lock aria-hidden="true" />
          Bloquear todos
        </Button>
        <Button variant="outline" size="sm" className="gap-1.5" disabled={disabled} onClick={() => onLockAll(false)}>
          <LockOpen aria-hidden="true" />
          Desbloquear
        </Button>
      </div>

      <form onSubmit={submitLink} className="flex gap-2">
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Link para abrir: escola.pt/prova"
          aria-label="Link a abrir no navegador de todos os alunos"
          inputMode="url"
          autoComplete="off"
          className="h-8 w-60"
          disabled={disabled}
        />
        <Button type="submit" size="sm" className="gap-1.5" disabled={disabled || !url.trim()}>
          <ExternalLink aria-hidden="true" />
          Enviar link
        </Button>
      </form>

      <form onSubmit={submitMessage} className="flex gap-2">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Aviso para todos"
          aria-label="Mensagem para todos os alunos"
          maxLength={140}
          autoComplete="off"
          className="h-8 w-52"
          disabled={disabled}
        />
        <Button type="submit" size="sm" variant="secondary" className="gap-1.5" disabled={disabled || !text.trim()}>
          <Send aria-hidden="true" />
          Avisar
        </Button>
      </form>
    </section>
  )
}

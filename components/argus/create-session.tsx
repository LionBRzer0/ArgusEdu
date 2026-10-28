"use client"

import { useMemo, useState, type FormEvent, type KeyboardEvent } from "react"
import { QRCodeSVG } from "qrcode.react"
import { Bot, Copy, Globe, Play, QrCode, RefreshCw, Trash2, UserPlus, Users, WifiOff } from "lucide-react"
import { toast } from "sonner"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { SavedTurmas } from "@/components/argus/saved-turmas"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { Restrictions, Turma } from "@/lib/classroom-data"
import { createTurma, randomCode } from "@/lib/classroom-db"
import { cn } from "@/lib/utils"
import { createClient } from "@/utils/supabase/client"

type RosterEntry = { name: string; email: string }

const restrictionOptions: { key: keyof Restrictions; label: string; description: string; icon: typeof Globe }[] = [
  { key: "blockBrowsers", label: "Bloquear Navegadores", description: "Chrome, Edge, Firefox e Opera", icon: Globe },
  { key: "disableInternet", label: "Desativar Internet", description: "Corta o acesso externo à rede", icon: WifiOff },
  {
    key: "restrictAI",
    label: "Restringir Ferramentas de IA",
    description: "ChatGPT, Claude, Gemini, Copilot",
    icon: Bot,
  },
]

function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("")
}

function StepHeading({ step, title, description }: { step: number; title: string; description: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-md border border-primary/30 bg-primary/10 font-mono text-xs text-primary">
        {step}
      </span>
      <div className="flex flex-col gap-0.5">
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}

export function CreateSession({ onStart }: { onStart: (turma: Turma) => void }) {
  const supabase = useMemo(() => createClient(), [])
  const [name, setName] = useState("")
  const [code, setCode] = useState(randomCode)
  const [saving, setSaving] = useState(false)
  const [roster, setRoster] = useState<RosterEntry[]>([])
  const [entry, setEntry] = useState("")
  const [restrictions, setRestrictions] = useState<Restrictions>({
    blockBrowsers: true,
    disableInternet: false,
    restrictAI: true,
  })

  const joinUrl = `https://argusedu.app/entrar/${code}`
  const activeCount = Object.values(restrictions).filter(Boolean).length

  function addStudent() {
    const value = entry.trim()
    if (!value) return
    const isEmail = value.includes("@")
    const student = isEmail
      ? {
          name: value
            .split("@")[0]
            .split(/[._-]/)
            .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
            .join(" "),
          email: value.toLowerCase(),
        }
      : { name: value, email: "" }
    if (roster.some((s) => (student.email && s.email === student.email) || s.name === student.name)) {
      toast.error("Este aluno já está na lista")
      return
    }
    setRoster((prev) => [...prev, student])
    setEntry("")
  }

  function handleEntryKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter" || e.nativeEvent.isComposing || e.keyCode === 229) return
    e.preventDefault()
    addStudent()
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code)
      toast.success("Código copiado", { description: code })
    } catch {
      toast.error("Não foi possível copiar o código")
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim() || saving) return
    setSaving(true)
    try {
      const turma = await createTurma(supabase, { name: name.trim(), code, restrictions, roster })
      onStart(turma)
    } catch (error) {
      console.error(error)
      toast.error("Não foi possível criar a turma", { description: (error as { message?: string }).message })
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 p-4 lg:p-8">
      <div className="mb-6 flex flex-col gap-1">
        <span className="font-mono text-[11px] uppercase tracking-widest text-primary">Nova sessão</span>
        <h1 className="text-2xl font-semibold tracking-tight">Criar Nova Prova / Sessão de Aula</h1>
        <p className="text-sm text-muted-foreground">
          Configure a turma, a forma de entrada dos alunos e as restrições antes de iniciar.
        </p>
      </div>

      <SavedTurmas onOpen={onStart} />

      <form onSubmit={handleSubmit} className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-4">
          <section className="flex flex-col gap-4 rounded-xl border bg-card p-5">
            <StepHeading step={1} title="Identificação" description="Nome visível para os alunos e no painel." />
            <div className="flex flex-col gap-2">
              <Label htmlFor="class-name">Nome da turma</Label>
              <Input
                id="class-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex.: 12º I - Programação"
                required
                className="h-10"
              />
            </div>
          </section>

          <section className="flex flex-col gap-4 rounded-xl border bg-card p-5">
            <StepHeading
              step={2}
              title="Alocação de alunos"
              description="Escolha como os alunos entram nesta sessão."
            />
            <Tabs defaultValue="code" className="gap-4">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="code" className="gap-1.5">
                  <QrCode aria-hidden="true" />
                  Código / QR Code
                </TabsTrigger>
                <TabsTrigger value="manual" className="gap-1.5">
                  <Users aria-hidden="true" />
                  Lista manual
                </TabsTrigger>
              </TabsList>

              <TabsContent value="code">
                <div className="flex flex-col items-center gap-5 rounded-lg border border-dashed bg-background/50 p-5 sm:flex-row">
                  <div className="rounded-xl bg-white p-3">
                    <QRCodeSVG value={joinUrl} size={132} bgColor="#ffffff" fgColor="#09090b" level="M" />
                    <span className="sr-only">QR Code para entrar na sessão com o código {code}</span>
                  </div>
                  <div className="flex flex-1 flex-col items-center gap-3 sm:items-start">
                    <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Código da sala
                    </span>
                    <output
                      aria-live="polite"
                      className="font-mono text-4xl font-semibold tracking-[0.2em] text-primary"
                    >
                      {code}
                    </output>
                    <p className="text-center text-xs text-muted-foreground sm:text-left">
                      {"Os alunos digitam o código ou leem o QR em "}
                      <span className="font-mono text-foreground">argusedu.app/entrar</span>
                    </p>
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={copyCode} className="gap-1.5">
                        <Copy aria-hidden="true" />
                        Copiar
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setCode(randomCode())}
                        className="gap-1.5"
                      >
                        <RefreshCw aria-hidden="true" />
                        Gerar novo
                      </Button>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="manual" className="flex flex-col gap-3">
                <div className="flex gap-2">
                  <Label htmlFor="student-entry" className="sr-only">
                    Nome ou email do aluno
                  </Label>
                  <Input
                    id="student-entry"
                    value={entry}
                    onChange={(e) => setEntry(e.target.value)}
                    onKeyDown={handleEntryKey}
                    placeholder="nome.apelido@escola.edu.pt ou nome"
                    className="h-9"
                  />
                  <Button type="button" onClick={addStudent} disabled={!entry.trim()} className="gap-1.5">
                    <UserPlus aria-hidden="true" />
                    Adicionar Aluno
                  </Button>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Alunos na lista</span>
                  <span className="font-mono">{roster.length}</span>
                </div>
                <ul className="flex max-h-56 flex-col divide-y overflow-y-auto rounded-lg border bg-background/50">
                  {roster.length === 0 && (
                    <li className="p-4 text-center text-sm text-muted-foreground">Nenhum aluno adicionado.</li>
                  )}
                  {roster.map((s) => (
                    <li key={s.email || s.name} className="flex items-center gap-3 px-3 py-2">
                      <Avatar className="size-7">
                        <AvatarFallback className="text-[10px]">{initialsOf(s.name)}</AvatarFallback>
                      </Avatar>
                      <div className="flex min-w-0 flex-1 flex-col leading-tight">
                        <span className="truncate text-sm">{s.name}</span>
                        {s.email && <span className="truncate text-xs text-muted-foreground">{s.email}</span>}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-7 text-muted-foreground hover:text-destructive"
                        onClick={() => setRoster((prev) => prev.filter((r) => r !== s))}
                        aria-label={`Remover ${s.name}`}
                      >
                        <Trash2 aria-hidden="true" />
                      </Button>
                    </li>
                  ))}
                </ul>
              </TabsContent>
            </Tabs>
          </section>
        </div>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-6 lg:self-start">
          <section className="flex flex-col gap-4 rounded-xl border bg-card p-5">
            <div className="flex items-start justify-between gap-2">
              <StepHeading step={3} title="Restrições" description="Aplicadas ao iniciar a sessão." />
              <Badge variant="outline" className="shrink-0 font-mono text-[10px]">
                {activeCount}/3
              </Badge>
            </div>
            <ul className="flex flex-col gap-2">
              {restrictionOptions.map(({ key, label, description, icon: Icon }) => {
                const on = restrictions[key]
                return (
                  <li key={key}>
                    <label
                      className={cn(
                        "flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors",
                        on ? "border-primary/40 bg-primary/10" : "bg-background/50 hover:bg-accent",
                      )}
                    >
                      <Icon className={cn("size-4 shrink-0", on ? "text-primary" : "text-muted-foreground")} aria-hidden="true" />
                      <span className="flex min-w-0 flex-1 flex-col leading-tight">
                        <span className="text-sm font-medium">{label}</span>
                        <span className="text-xs text-muted-foreground">{description}</span>
                      </span>
                      <Switch
                        checked={on}
                        onCheckedChange={(v) => setRestrictions((prev) => ({ ...prev, [key]: v }))}
                        aria-label={label}
                      />
                    </label>
                  </li>
                )
              })}
            </ul>
          </section>

          <Button type="submit" size="lg" disabled={!name.trim() || saving} className="h-12 gap-2 text-sm font-semibold">
            <Play aria-hidden="true" />
            {saving ? "A criar…" : "Iniciar Sessão e Abrir Painel"}
          </Button>
        </aside>
      </form>
    </main>
  )
}

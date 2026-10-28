"use client"

import { useEffect, useMemo, useState } from "react"
import { Users } from "lucide-react"
import { toast } from "sonner"
import { ClassroomGrid } from "@/components/argus/classroom-grid"
import { CommandBar } from "@/components/argus/command-bar"
import { StudentDrawer } from "@/components/argus/student-drawer"
import { TopHeader } from "@/components/argus/top-header"
import { Button } from "@/components/ui/button"
import { TooltipProvider } from "@/components/ui/tooltip"
import type { Student, Turma } from "@/lib/classroom-data"
import {
  deleteStudent,
  deleteTurma,
  fetchStudents,
  fetchTurma,
  rowToStudent,
  saveEndSession,
  saveExamMode,
  saveLockAll,
  updateStudent,
  type AlunoRow,
} from "@/lib/classroom-db"
import { ALL_STUDENTS, safeUrl, type Command } from "@/lib/commands"
import { useTeacherCommands } from "@/lib/use-teacher-commands"
import { createClient } from "@/utils/supabase/client"

type Phase = "loading" | "ready" | "empty" | "error"

const byDesk = (a: Student, b: Student) => a.desk.localeCompare(b.desk, undefined, { numeric: true })

function Notice({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-10 text-center text-muted-foreground">
      <Users className="size-8" aria-hidden="true" />
      <p className="text-sm">{title}</p>
      {children}
    </div>
  )
}

type DashboardProps = {
  /** Sem id, abre a sessão ativa mais recente do professor. */
  turmaId: string | null
  onCreate: () => void
  /** A turma foi apagada: o painel já não tem nada para mostrar. */
  onDeleted: () => void
}

export function Dashboard({ turmaId, onCreate, onDeleted }: DashboardProps) {
  const supabase = useMemo(() => createClient(), [])
  const [phase, setPhase] = useState<Phase>("loading")
  const [attempt, setAttempt] = useState(0)
  const [turma, setTurma] = useState<Turma | null>(null)
  const [students, setStudents] = useState<Student[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const loadedId = turma?.id ?? null
  const selected = students.find((s) => s.id === selectedId) ?? null
  const commands = useTeacherCommands(supabase, loadedId)

  // Lê turma + alunos do Supabase
  useEffect(() => {
    let cancelled = false
    async function load() {
      setPhase("loading")
      try {
        const found = await fetchTurma(supabase, turmaId ?? undefined)
        if (cancelled) return
        if (!found) {
          setTurma(null)
          setStudents([])
          setPhase("empty")
          return
        }
        const list = await fetchStudents(supabase, found.id)
        if (cancelled) return
        setTurma(found)
        setStudents(list)
        setSelectedId(null)
        setDrawerOpen(false)
        setPhase("ready")
      } catch (error) {
        console.error(error)
        if (!cancelled) setPhase("error")
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [supabase, turmaId, attempt])

  // Alterações nos alunos (alunos a entrar/sair, estado da partilha…) chegam ao vivo
  useEffect(() => {
    if (!loadedId) return
    const channel = supabase
      .channel(`alunos-${loadedId}-${Math.random().toString(36).slice(2)}`) // nome único: evita reutilizar um canal já a fechar (modo estrito do React)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "alunos", filter: `turma_id=eq.${loadedId}` },
        (payload) => {
          if (payload.eventType === "DELETE") {
            const removedId = (payload.old as { id?: string }).id
            if (removedId) setStudents((prev) => prev.filter((s) => s.id !== removedId))
            return
          }
          const incoming = rowToStudent(payload.new as AlunoRow)
          setStudents((prev) =>
            prev.some((s) => s.id === incoming.id)
              ? prev.map((s) => (s.id === incoming.id ? incoming : s))
              : [...prev, incoming].sort(byDesk),
          )
        },
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [supabase, loadedId])

  /** Corre a gravação; se falhar, avisa e volta a ler o estado real da base de dados. */
  async function save(task: Promise<unknown>, failMessage: string) {
    try {
      await task
    } catch (error) {
      console.error(error)
      toast.error(failMessage)
      if (loadedId) {
        try {
          setStudents(await fetchStudents(supabase, loadedId))
        } catch {}
      }
    }
  }

  /** Envia um comando em tempo real a um aluno (ou a todos) e avisa se não saiu. */
  async function deliver(to: string, command: Command, successMessage?: string) {
    const ok = await commands.send(to, command)
    if (!ok) {
      toast.error("Não foi possível entregar o comando", {
        description: "O canal da sala ainda não está ligado. Tente outra vez dentro de alguns segundos.",
      })
    } else if (successMessage) {
      toast.success(successMessage)
    }
    return ok
  }

  function update(id: string, patch: (s: Student) => Partial<Student>) {
    const current = students.find((s) => s.id === id)
    if (!current) return
    const changes = patch(current)
    setStudents((prev) => prev.map((s) => (s.id === id ? { ...s, ...changes } : s)))
    void save(updateStudent(supabase, id, changes), "Não foi possível guardar a alteração")
  }

  function nameOf(id: string) {
    return students.find((s) => s.id === id)?.name ?? "Aluno"
  }

  function openStudent(id: string) {
    setSelectedId(id)
    setDrawerOpen(true)
  }

  // ── Comandos para um aluno ────────────────────────────────────────────────

  function toggleLock(id: string) {
    const locked = !students.find((s) => s.id === id)?.locked
    update(id, () => ({ locked })) // guarda na base de dados (se o aluno recarregar a página continua bloqueado)
    void deliver(id, { type: locked ? "LOCK_SCREEN" : "UNLOCK_SCREEN" }) // e bloqueia na hora
    toast(locked ? `Tela de ${nameOf(id)} bloqueada` : `Tela de ${nameOf(id)} desbloqueada`)
  }

  function sendMessage(id: string, message: string) {
    void deliver(id, { type: "MESSAGE", text: message }, `Mensagem enviada para ${nameOf(id)}`)
  }

  async function sendLink(to: string, rawUrl: string) {
    const url = safeUrl(rawUrl)
    if (!url) {
      toast.error("Endereço inválido", { description: "Use um endereço http:// ou https://" })
      return false
    }
    return deliver(
      to,
      { type: "NAVIGATE_TO", url },
      to === ALL_STUDENTS ? "Link enviado a todos os alunos" : `Link enviado para ${nameOf(to)}`,
    )
  }

  function toggleBrowsers(id: string, value: boolean) {
    update(id, (s) => ({
      browsersBlocked: value,
      ...(value && {
        processes: s.processes.filter((p) => !p.name.startsWith("chrome")),
        ...(s.status === "alert" && { status: "online" as const, alertReason: undefined, activeWindow: "Área de trabalho" }),
      }),
    }))
    toast(value ? `Navegadores bloqueados para ${nameOf(id)}` : `Navegadores liberados para ${nameOf(id)}`)
  }

  function killProcess(id: string, pid: number) {
    const proc = students.find((s) => s.id === id)?.processes.find((p) => p.pid === pid)
    update(id, (s) => {
      const processes = s.processes.filter((p) => p.pid !== pid)
      const stillFlagged = processes.some((p) => p.flagged)
      return {
        processes,
        ...(s.status === "alert" && !stillFlagged && { status: "online" as const, alertReason: undefined, activeWindow: "Área de trabalho" }),
      }
    })
    toast.success(`Processo ${proc?.name ?? pid} encerrado`)
  }

  async function removeStudent(id: string) {
    const name = nameOf(id)
    setDrawerOpen(false)
    setStudents((prev) => prev.filter((s) => s.id !== id))
    toast(`${name} removido do monitoramento`)
    await commands.send(id, { type: "REMOVE_STUDENT" }) // o aluno para de partilhar e sai da sala
    await save(deleteStudent(supabase, id), "Não foi possível remover o aluno")
  }

  // ── Comandos para toda a turma ────────────────────────────────────────────

  function lockAll(locked: boolean) {
    if (!turma) return
    setStudents((prev) => prev.map((s) => (s.status === "offline" ? s : { ...s, locked })))
    void deliver(ALL_STUDENTS, { type: locked ? "LOCK_SCREEN" : "UNLOCK_SCREEN" })
    void save(saveLockAll(supabase, turma.id, locked), "Não foi possível guardar o bloqueio")
    toast(locked ? "Todas as telas bloqueadas" : "Todas as telas desbloqueadas")
  }

  function handleExamMode(value: boolean) {
    if (!turma) return
    setTurma({ ...turma, examMode: value })
    if (value) {
      setStudents((prev) => prev.map((s) => (s.status === "offline" ? s : { ...s, browsersBlocked: true })))
      toast.success("Modo Prova ativado", { description: "Navegadores bloqueados em todas as estações." })
    } else {
      toast("Modo Prova desativado")
    }
    void save(saveExamMode(supabase, turma.id, value), "Não foi possível guardar o Modo Prova")
  }

  /** Encerra a sessão: os alunos param de partilhar e saem da sala (a turma fica guardada para reabrir). */
  function endSession() {
    if (!turma) return
    const id = turma.id
    const endedAt = new Date().toISOString()
    setTurma({ ...turma, active: false, examMode: false, endedAt })
    setDrawerOpen(false)
    setStudents((prev) =>
      prev.map((s) => ({
        ...s,
        status: "offline",
        activeWindow: "Desconectado",
        screen: "",
        locked: false,
        alertReason: undefined,
        processes: [],
      })),
    )
    toast.error("Sessão encerrada", { description: "Todos os alunos foram desligados." })
    void (async () => {
      await deliver(ALL_STUDENTS, { type: "END_SESSION" })
      await save(saveEndSession(supabase, id, endedAt), "Não foi possível encerrar a sessão")
    })()
  }

  /** Apaga a turma e os seus alunos. Os alunos ligados são avisados primeiro. */
  async function deleteThisTurma() {
    if (!turma) return
    await commands.send(ALL_STUDENTS, { type: "END_SESSION" })
    try {
      await deleteTurma(supabase, turma.id)
      toast.success(`Turma "${turma.name}" apagada`)
      onDeleted()
    } catch (error) {
      console.error(error)
      toast.error("Não foi possível apagar a turma")
    }
  }

  if (phase === "loading") return <Notice title="A carregar a turma…" />

  if (phase === "error")
    return (
      <Notice title="Não foi possível carregar a turma.">
        <Button variant="outline" size="sm" onClick={() => setAttempt((n) => n + 1)}>
          Tentar novamente
        </Button>
      </Notice>
    )

  if (phase === "empty" || !turma)
    return (
      <Notice title="Ainda não tem nenhuma turma.">
        <Button size="sm" onClick={onCreate}>
          Criar turma
        </Button>
      </Notice>
    )

  return (
    <TooltipProvider>
      <div className="flex-1">
        <TopHeader
          sessionName={turma.name}
          roomCode={turma.code}
          sessionActive={turma.active}
          startedAt={turma.startedAt}
          endedAt={turma.endedAt}
          examMode={turma.examMode}
          onExamModeChange={handleExamMode}
          onEndSession={endSession}
          onDelete={deleteThisTurma}
        />
        <main className="mx-auto w-full max-w-[1600px] p-4 lg:p-6">
          <CommandBar
            disabled={!turma.active || !commands.ready}
            onLockAll={lockAll}
            onSendLink={(url) => sendLink(ALL_STUDENTS, url)}
            onSendMessage={(text) => void deliver(ALL_STUDENTS, { type: "MESSAGE", text }, "Aviso enviado a todos os alunos")}
          />
          <ClassroomGrid students={students} selectedId={drawerOpen ? selectedId : null} onOpen={openStudent} onToggleLock={toggleLock} />
        </main>
        <StudentDrawer
          turmaId={turma.id}
          student={selected}
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          onToggleBrowsers={toggleBrowsers}
          onToggleLock={toggleLock}
          onKillProcess={killProcess}
          onSendMessage={sendMessage}
          onSendLink={sendLink}
          onRemove={removeStudent}
        />
      </div>
    </TooltipProvider>
  )
}

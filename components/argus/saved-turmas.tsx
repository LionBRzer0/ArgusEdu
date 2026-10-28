"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { DoorOpen, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { ConfirmButton } from "@/components/argus/confirm-button"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { Turma, TurmaListItem } from "@/lib/classroom-data"
import { ALL_STUDENTS, sendCommandOnce } from "@/lib/commands"
import { deleteClosedTurmas, deleteTurma, fetchTurmas, reopenTurma } from "@/lib/classroom-db"
import { createClient } from "@/utils/supabase/client"

/** Salas já criadas: voltar a abri-las (mesmo código) ou apagá-las. Não aparece se ainda não houver nenhuma. */
export function SavedTurmas({ onOpen }: { onOpen: (turma: Turma) => void }) {
  const supabase = useMemo(() => createClient(), [])
  const [items, setItems] = useState<TurmaListItem[] | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setItems(await fetchTurmas(supabase))
    } catch (error) {
      console.error(error)
      setItems([])
    }
  }, [supabase])

  useEffect(() => {
    void load()
  }, [load])

  async function open(item: TurmaListItem) {
    setBusyId(item.id)
    try {
      const turma = item.active ? item : await reopenTurma(supabase, item.id)
      onOpen(turma)
    } catch (error) {
      console.error(error)
      toast.error("Não foi possível abrir a sala")
      setBusyId(null)
    }
  }

  async function remove(item: TurmaListItem) {
    setBusyId(item.id)
    try {
      // Se houver alunos ligados, avisa-os primeiro: param a partilha e saem da sala
      if (item.active) await sendCommandOnce(supabase, item.id, ALL_STUDENTS, { type: "END_SESSION" })
      await deleteTurma(supabase, item.id)
      toast.success(`Turma "${item.name}" apagada`)
      await load()
    } catch (error) {
      console.error(error)
      toast.error("Não foi possível apagar a turma")
    } finally {
      setBusyId(null)
    }
  }

  async function removeClosed() {
    try {
      await deleteClosedTurmas(supabase)
      toast.success("Turmas encerradas apagadas")
      await load()
    } catch (error) {
      console.error(error)
      toast.error("Não foi possível apagar as turmas encerradas")
    }
  }

  if (!items || items.length === 0) return null
  const closedCount = items.filter((i) => !i.active).length

  return (
    <section aria-labelledby="saved-title" className="mb-6 flex flex-col gap-3 rounded-xl border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 id="saved-title" className="text-sm font-semibold">
            As suas turmas
          </h2>
          <p className="text-xs text-muted-foreground">
            Volte a abrir uma sala (o código é o mesmo) em vez de criar outra, ou apague as que já não usa.
          </p>
        </div>
        {closedCount > 0 && (
          <ConfirmButton variant="outline" size="sm" className="gap-1.5" confirmLabel={`Apagar ${closedCount}?`} onConfirm={removeClosed}>
            <Trash2 aria-hidden="true" />
            Apagar encerradas ({closedCount})
          </ConfirmButton>
        )}
      </div>

      <ul className="divide-y rounded-lg border">
        {items.map((item) => (
          <li key={item.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 p-3">
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate text-sm font-medium">{item.name}</span>
              <span className="text-xs text-muted-foreground">
                {item.studentCount} {item.studentCount === 1 ? "aluno" : "alunos"} · {new Date(item.startedAt).toLocaleDateString("pt-PT")}
              </span>
            </div>
            <span className="font-mono text-sm tracking-[0.15em] text-primary">{item.code}</span>
            <Badge variant="outline" className={item.active ? "border-primary/30 text-primary" : "text-muted-foreground"}>
              {item.active ? "Ativa" : "Encerrada"}
            </Badge>
            <div className="flex gap-2">
              <Button size="sm" className="gap-1.5" disabled={busyId === item.id} onClick={() => open(item)}>
                <DoorOpen aria-hidden="true" />
                {item.active ? "Continuar" : "Reabrir"}
              </Button>
              <ConfirmButton
                variant="outline"
                size="sm"
                className="gap-1.5"
                disabled={busyId === item.id}
                confirmLabel="Apagar?"
                onConfirm={() => remove(item)}
                aria-label={`Apagar turma ${item.name}`}
              >
                <Trash2 aria-hidden="true" />
                Apagar
              </ConfirmButton>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

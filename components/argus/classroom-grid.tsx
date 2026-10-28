"use client"

import { Fragment, useState } from "react"
import { AlertTriangle, Lock, Presentation, Search, SearchX, Users, Wifi, WifiOff, X } from "lucide-react"
import { DeskCard } from "@/components/argus/desk-card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { Student } from "@/lib/classroom-data"
import { cn } from "@/lib/utils"

type ClassroomGridProps = {
  students: Student[]
  selectedId: string | null
  onOpen: (id: string) => void
  onToggleLock: (id: string) => void
}

type Filter = "all" | "online" | "alert" | "locked" | "offline"

const matchesFilter: Record<Filter, (s: Student) => boolean> = {
  all: () => true,
  online: (s) => s.status === "online",
  alert: (s) => s.status === "alert",
  locked: (s) => s.locked,
  offline: (s) => s.status === "offline",
}

function normalize(text: string) {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
}

function Stat({
  icon: Icon,
  label,
  value,
  tone = "default",
  active,
  onClick,
}: {
  icon: typeof Users
  label: string
  value: number
  tone?: "default" | "primary" | "destructive"
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex items-center gap-3 rounded-xl border bg-card px-4 py-3 text-left transition-colors",
        "hover:border-foreground/20 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active && tone === "primary" && "border-primary/60 bg-primary/5 ring-1 ring-primary/40",
        active && tone === "destructive" && "border-destructive/60 bg-destructive/5 ring-1 ring-destructive/40",
        active && tone === "default" && "border-foreground/40 bg-accent/60 ring-1 ring-foreground/20",
      )}
    >
      <div
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-lg",
          tone === "primary" && "bg-primary/10 text-primary",
          tone === "destructive" && "bg-destructive/10 text-destructive",
          tone === "default" && "bg-muted text-muted-foreground",
        )}
      >
        <Icon className="size-4" aria-hidden="true" />
      </div>
      <div className="flex flex-col leading-tight">
        <span className="font-mono text-xl font-semibold tabular-nums">{value}</span>
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
    </button>
  )
}

export function ClassroomGrid({ students, selectedId, onOpen, onToggleLock }: ClassroomGridProps) {
  const [filter, setFilter] = useState<Filter>("all")
  const [query, setQuery] = useState("")

  const online = students.filter(matchesFilter.online).length
  const alerts = students.filter(matchesFilter.alert).length
  const offline = students.filter(matchesFilter.offline).length
  const locked = students.filter(matchesFilter.locked).length

  const normalizedQuery = normalize(query.trim())
  const visible = students.filter(
    (s) =>
      matchesFilter[filter](s) &&
      (!normalizedQuery ||
        normalize(s.name).includes(normalizedQuery) ||
        normalize(s.desk).includes(normalizedQuery) ||
        normalize(s.activeWindow).includes(normalizedQuery)),
  )
  const isFiltering = filter !== "all" || normalizedQuery.length > 0

  const toggleFilter = (next: Filter) => setFilter((current) => (current === next ? "all" : next))

  const rows = Array.from(new Set(visible.map((s) => s.desk[0])))

  return (
    <section aria-labelledby="planta-title" className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        <Stat icon={Users} label="Todos" value={students.length} active={filter === "all"} onClick={() => setFilter("all")} />
        <Stat icon={Wifi} label="Online" value={online} tone="primary" active={filter === "online"} onClick={() => toggleFilter("online")} />
        <Stat icon={AlertTriangle} label="Alertas" value={alerts} tone="destructive" active={filter === "alert"} onClick={() => toggleFilter("alert")} />
        <Stat icon={Lock} label="Bloqueados" value={locked} active={filter === "locked"} onClick={() => toggleFilter("locked")} />
        <Stat icon={WifiOff} label="Offline" value={offline} active={filter === "offline"} onClick={() => toggleFilter("offline")} />
      </div>

      <div className="rounded-2xl border bg-card/40 p-4 lg:p-6">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 id="planta-title" className="text-lg font-semibold tracking-tight">
              Planta da Sala
            </h1>
            <p className="text-sm text-muted-foreground" aria-live="polite">
              {isFiltering
                ? `${visible.length} de ${students.length} estações`
                : `${students.length} estações`}{" "}
              · clique em uma mesa para ver detalhes
            </p>
          </div>
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <div className="relative flex-1 sm:w-64 sm:flex-none">
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar aluno, mesa ou janela..."
                aria-label="Buscar aluno, mesa ou janela"
                className="h-9 pl-8"
              />
            </div>
            {isFiltering && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFilter("all")
                  setQuery("")
                }}
              >
                <X className="size-4" aria-hidden="true" />
                Limpar
              </Button>
            )}
          </div>
        </div>

        <div className="mb-4 flex items-center justify-end gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-primary" aria-hidden="true" /> Online
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-destructive" aria-hidden="true" /> Alerta
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-muted-foreground/50" aria-hidden="true" /> Offline
            </span>
        </div>

        <div className="mb-6 flex items-center justify-center gap-2 rounded-lg border border-dashed py-2.5 text-xs font-medium uppercase tracking-widest text-muted-foreground">
          <Presentation className="size-4" aria-hidden="true" />
          Quadro · Mesa do Professor
        </div>

        {students.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-20 text-center text-muted-foreground">
            <WifiOff className="size-8" aria-hidden="true" />
            <p className="text-sm">Nenhuma estação conectada.</p>
          </div>
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-center text-muted-foreground">
            <SearchX className="size-8" aria-hidden="true" />
            <p className="text-sm">Nenhuma estação corresponde ao filtro.</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setFilter("all")
                setQuery("")
              }}
            >
              Limpar filtros
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            {rows.map((row) => {
              const rowStudents = visible.filter((s) => s.desk[0] === row)
              const left = rowStudents.filter((s) => Number(s.desk.slice(1)) <= 2)
              const right = rowStudents.filter((s) => Number(s.desk.slice(1)) > 2)
              return (
                <div key={row} className="flex items-stretch gap-3">
                  <div className="flex w-6 shrink-0 items-center justify-center font-mono text-xs text-muted-foreground">
                    {row}
                  </div>
                  <div className="grid flex-1 grid-cols-1 gap-3 md:grid-cols-2 md:gap-8">
                    {[left, right].map((group, i) => (
                      <Fragment key={i}>
                        <div className="grid grid-cols-2 gap-3">
                          {group.map((student) => (
                            <DeskCard
                              key={student.id}
                              student={student}
                              selected={selectedId === student.id}
                              onOpen={() => onOpen(student.id)}
                              onToggleLock={() => onToggleLock(student.id)}
                            />
                          ))}
                        </div>
                      </Fragment>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}

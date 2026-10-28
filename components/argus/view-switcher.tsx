"use client"

import { LayoutGrid, LogIn, PlusSquare } from "lucide-react"
import { cn } from "@/lib/utils"

export type AppView = "login" | "create" | "dashboard"

const views: { id: AppView; label: string; icon: typeof LogIn }[] = [
  { id: "login", label: "Login", icon: LogIn },
  { id: "create", label: "Criar Turma", icon: PlusSquare },
  { id: "dashboard", label: "Painel ao Vivo", icon: LayoutGrid },
]

type ViewSwitcherProps = {
  view: AppView
  onChange: (view: AppView) => void
}

export function ViewSwitcher({ view, onChange }: ViewSwitcherProps) {
  return (
    <nav
      aria-label="Navegação do protótipo"
      className="flex h-11 items-center gap-3 border-b border-dashed bg-muted/40 px-4 lg:px-6"
    >
      <span className="hidden font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground sm:inline">
        Protótipo
      </span>
      <div className="flex items-center gap-1 rounded-lg border bg-background/60 p-0.5">
        {views.map(({ id, label, icon: Icon }, index) => {
          const active = view === id
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active
                  ? "bg-primary/15 text-primary ring-1 ring-primary/30"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              <span className="font-mono text-[10px] opacity-60" aria-hidden="true">
                {index + 1}
              </span>
              <Icon className="size-3.5" aria-hidden="true" />
              {label}
            </button>
          )
        })}
      </div>
    </nav>
  )
}

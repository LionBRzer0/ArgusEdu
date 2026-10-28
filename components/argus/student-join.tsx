"use client"

import { useState, type FormEvent } from "react"
import type { User } from "@supabase/supabase-js"
import { LogIn, LogOut } from "lucide-react"
import { BrandMark } from "@/components/argus/brand"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { StudentSession } from "@/lib/classroom-data"
import { joinTurma } from "@/lib/classroom-db"
import { createClient } from "@/utils/supabase/client"

/** "k7x92q" → "K7X-92Q" */
function formatCode(value: string) {
  const clean = value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6)
  return clean.length > 3 ? `${clean.slice(0, 3)}-${clean.slice(3)}` : clean
}

type StudentJoinProps = {
  user: User | null
  /** Motivo pelo qual saiu da sala anterior, se saiu. */
  notice?: string | null
  onJoined: (session: StudentSession) => void
  onLogout: () => void
}

export function StudentJoin({ user, notice, onJoined, onLogout }: StudentJoinProps) {
  const [code, setCode] = useState("")
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (code.length < 7 || joining) return
    setJoining(true)
    setError(null)
    try {
      onJoined(await joinTurma(createClient(), code))
    } catch (err) {
      console.error(err)
      setError((err as { message?: string }).message ?? "Não foi possível entrar na turma.")
      setJoining(false)
    }
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 p-6">
      <BrandMark />
      <section
        aria-labelledby="join-title"
        className="w-full max-w-md overflow-hidden rounded-2xl border bg-card shadow-2xl shadow-black/20"
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-5 p-6">
          <div className="flex flex-col gap-1.5">
            <h1 id="join-title" className="text-lg font-semibold tracking-tight">
              Entrar numa sala
            </h1>
            <p className="text-sm text-muted-foreground">
              {user?.email ? `Sessão iniciada como ${user.email}. ` : ""}Escreva o código que o professor mostrou no ecrã.
            </p>
          </div>

          {notice && (
            <p role="status" className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-sm">
              {notice}
            </p>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="room-code">Código da sala</Label>
            <Input
              id="room-code"
              value={code}
              onChange={(e) => setCode(formatCode(e.target.value))}
              placeholder="K7X-92Q"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              className="h-12 text-center font-mono text-2xl tracking-[0.2em]"
            />
            {error && (
              <p role="alert" className="text-xs text-destructive">
                {error}
              </p>
            )}
          </div>

          <Button type="submit" size="lg" disabled={code.length < 7 || joining} className="h-11 gap-2">
            <LogIn aria-hidden="true" />
            {joining ? "A entrar…" : "Entrar na sala"}
          </Button>
          <Button type="button" variant="ghost" onClick={onLogout} className="gap-2">
            <LogOut aria-hidden="true" />
            Terminar sessão
          </Button>
        </form>
      </section>
    </main>
  )
}

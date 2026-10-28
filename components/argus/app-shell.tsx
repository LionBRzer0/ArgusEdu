"use client"

import { useEffect, useRef, useState } from "react"
import type { Session, User } from "@supabase/supabase-js"
import { toast } from "sonner"
import { CreateSession } from "@/components/argus/create-session"
import { Dashboard } from "@/components/argus/dashboard"
import { LoginScreen, ROLE_STORAGE_KEY } from "@/components/argus/login-screen"
import { StudentJoin } from "@/components/argus/student-join"
import { StudentWaiting, type EndReason } from "@/components/argus/student-waiting"
import { ViewSwitcher, type AppView } from "@/components/argus/view-switcher"
import type { StudentSession, Turma } from "@/lib/classroom-data"
import { leaveTurma } from "@/lib/classroom-db"
import { createClient } from "@/utils/supabase/client"

export function AppShell() {
  const [view, setView] = useState<AppView>("login")
  const [studentSignedIn, setStudentSignedIn] = useState(false)
  const [studentSession, setStudentSession] = useState<StudentSession | null>(null)
  const [studentNotice, setStudentNotice] = useState<string | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [turmaId, setTurmaId] = useState<string | null>(null)
  const routed = useRef(false)

  // Acompanha a sessão do Supabase (o login com Google devolve o utilizador a esta página)
  useEffect(() => {
    const supabase = createClient()

    function apply(session: Session | null) {
      const next = session?.user ?? null
      setUser(next)
      if (!next) {
        routed.current = false
        return
      }
      if (routed.current) return
      routed.current = true

      if (localStorage.getItem(ROLE_STORAGE_KEY) === "student") {
        setStudentSignedIn(true)
        return
      }
      setView("create")
      toast.success(`Sessão iniciada como ${next.user_metadata?.full_name ?? next.email ?? "professor"}`)
    }

    supabase.auth.getSession().then(({ data }) => apply(data.session))
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => apply(session))
    return () => subscription.unsubscribe()
  }, [])

  function changeView(next: AppView) {
    if (next !== "login" && !user) {
      toast.error("Inicie sessão com a sua conta Google para continuar")
      return
    }
    if (next === "login") {
      setStudentSignedIn(false)
      void leaveClass()
    }
    setView(next)
  }

  /** Marca o aluno como offline na turma onde estava (se estava numa). */
  async function leaveClass() {
    if (!studentSession) return
    setStudentSession(null)
    try {
      await leaveTurma(createClient())
    } catch (error) {
      console.error(error)
    }
  }

  /** O professor encerrou a sessão ou removeu o aluno: sai da sala e volta ao ecrã do código. */
  function handleStudentEnded(reason: EndReason) {
    setStudentNotice(reason === "ended" ? "O professor encerrou a sessão." : "Foi removido da sala pelo professor.")
    void leaveClass()
  }

  async function handleStudentLogout() {
    setStudentNotice(null)
    localStorage.removeItem(ROLE_STORAGE_KEY)
    await leaveClass() // tem de acontecer antes do signOut, que precisa da sessão
    await createClient().auth.signOut()
    setStudentSignedIn(false)
  }

  function handleStart(turma: Turma) {
    setTurmaId(turma.id)
    setView("dashboard")
    toast.success(`Sessão "${turma.name}" iniciada`)
  }

  return (
    <div className="flex min-h-dvh flex-col bg-[radial-gradient(ellipse_at_top,oklch(0.765_0.165_158/0.06),transparent_50%)]">
      <ViewSwitcher view={view} onChange={changeView} />
      {view === "login" &&
        (studentSignedIn ? (
          studentSession ? (
            <StudentWaiting session={studentSession} user={user} onLogout={handleStudentLogout} onEnded={handleStudentEnded} />
          ) : (
            <StudentJoin
              user={user}
              notice={studentNotice}
              onJoined={(joined) => {
                setStudentNotice(null)
                setStudentSession(joined)
              }}
              onLogout={handleStudentLogout}
            />
          )
        ) : (
          <LoginScreen />
        ))}
      {view === "create" && <CreateSession onStart={handleStart} />}
      {view === "dashboard" && <Dashboard
          turmaId={turmaId}
          onCreate={() => setView("create")}
          onDeleted={() => {
            setTurmaId(null)
            setView("create")
          }}
        />}
    </div>
  )
}

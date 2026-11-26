"use client"

import { useEffect, useRef, useState } from "react"
import type { Session, User } from "@supabase/supabase-js"
import { toast } from "sonner"
import { CreateSession } from "@/components/argus/create-session"
import { Dashboard } from "@/components/argus/dashboard"
import { LoginScreen, ROLE_STORAGE_KEY, type LoginRole } from "@/components/argus/login-screen"
import { StudentJoin } from "@/components/argus/student-join"
import { StudentWaiting, type EndReason } from "@/components/argus/student-waiting"
import type { StudentSession, Turma } from "@/lib/classroom-data"
import { leaveTurma } from "@/lib/classroom-db"
import { createClient } from "@/utils/supabase/client"

/** Ecrãs do professor. O aluno nunca chega a estes ecrãs. */
type TeacherView = "create" | "dashboard"

function readRole(): LoginRole | null {
  try {
    const value = localStorage.getItem(ROLE_STORAGE_KEY)
    return value === "student" || value === "professor" ? value : null
  } catch {
    return null
  }
}

export function AppShell() {
  const [ready, setReady] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [role, setRole] = useState<LoginRole | null>(null)
  const [teacherView, setTeacherView] = useState<TeacherView>("create")
  const [turmaId, setTurmaId] = useState<string | null>(null)
  const [studentSession, setStudentSession] = useState<StudentSession | null>(null)
  const [studentNotice, setStudentNotice] = useState<string | null>(null)
  const greeted = useRef(false)

  // Acompanha a sessão do Supabase (o login com Google devolve o utilizador a esta página)
  useEffect(() => {
    const supabase = createClient()

    function apply(session: Session | null) {
      const next = session?.user ?? null
      setUser(next)
      setReady(true)
      if (!next) {
        greeted.current = false
        setRole(null)
        return
      }
      // O papel escolhido no ecrã de login. Sem papel guardado, fica como aluno (o papel com menos acesso).
      const nextRole = readRole() ?? "student"
      setRole(nextRole)
      if (greeted.current) return
      greeted.current = true
      if (nextRole === "professor") {
        toast.success(`Sessão iniciada como ${next.user_metadata?.full_name ?? next.email ?? "professor"}`)
      }
    }

    supabase.auth.getSession().then(({ data }) => apply(data.session))
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => apply(session))
    return () => subscription.unsubscribe()
  }, [])

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

  async function logout() {
    setStudentNotice(null)
    await leaveClass() // tem de acontecer antes do signOut, que precisa da sessão
    try {
      localStorage.removeItem(ROLE_STORAGE_KEY)
    } catch {}
    await createClient().auth.signOut()
    setTurmaId(null)
    setTeacherView("create")
  }

  function handleStart(turma: Turma) {
    setTurmaId(turma.id)
    setTeacherView("dashboard")
    toast.success(`Sessão "${turma.name}" iniciada`)
  }

  function backToTurmas() {
    setTurmaId(null)
    setTeacherView("create")
  }

  let content: React.ReactNode
  if (!ready) {
    content = null
  } else if (!user || !role) {
    content = <LoginScreen />
  } else if (role === "student") {
    content = studentSession ? (
      <StudentWaiting session={studentSession} user={user} onLogout={logout} onEnded={handleStudentEnded} />
    ) : (
      <StudentJoin
        user={user}
        notice={studentNotice}
        onJoined={(joined) => {
          setStudentNotice(null)
          setStudentSession(joined)
        }}
        onLogout={logout}
      />
    )
  } else if (teacherView === "dashboard") {
    content = (
      <Dashboard
        turmaId={turmaId}
        onCreate={backToTurmas}
        onBack={backToTurmas}
        onDeleted={backToTurmas}
      />
    )
  } else {
    content = <CreateSession onStart={handleStart} onLogout={logout} />
  }

  return (
    <div className="flex min-h-dvh flex-col bg-[radial-gradient(ellipse_at_top,oklch(0.765_0.165_158/0.06),transparent_50%)]">
      {content}
    </div>
  )
}

"use client"

import { useState } from "react"
import { Eye, GraduationCap, Lock, MonitorSmartphone, Presentation, ShieldCheck } from "lucide-react"
import { BrandMark, GoogleIcon } from "@/components/argus/brand"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { createClient } from "@/utils/supabase/client"

export type LoginRole = "professor" | "student"

/** Guarda o perfil escolhido, porque o login com Google recarrega a página. */
export const ROLE_STORAGE_KEY = "argus:role"

const roles: { id: LoginRole; label: string; hint: string; icon: typeof Presentation }[] = [
  { id: "professor", label: "Sou Professor", hint: "Criar e monitorar sessões", icon: Presentation },
  { id: "student", label: "Sou Aluno", hint: "Entrar numa sessão", icon: GraduationCap },
]

const features = [
  { icon: Eye, title: "Monitoramento em tempo real", text: "Veja todas as telas do laboratório num só painel." },
  { icon: Lock, title: "Controle de estações", text: "Bloqueie navegadores, apps e ferramentas de IA." },
  { icon: MonitorSmartphone, title: "Sessões com código ou QR", text: "Os alunos entram numa sala em segundos." },
]

export function LoginScreen() {
  const [role, setRole] = useState<LoginRole>("professor")
  const [isSigningIn, setIsSigningIn] = useState(false)

  async function handleGoogleSignIn() {
    setIsSigningIn(true)
    localStorage.setItem(ROLE_STORAGE_KEY, role)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin }, // volta ao endereço onde a app está aberta
    })
    if (error) setIsSigningIn(false)
  }

  return (
    <main className="grid flex-1 lg:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden flex-col justify-between overflow-hidden border-r bg-card/40 p-10 lg:flex">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] bg-[size:40px_40px] opacity-40 [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]"
        />
        <BrandMark size="lg" className="relative" />
        <div className="relative flex max-w-md flex-col gap-8">
          <div className="flex flex-col gap-3">
            <h1 className="text-balance text-4xl font-semibold leading-tight tracking-tight">
              A sala inteira, <span className="text-primary">sob o seu olhar.</span>
            </h1>
            <p className="text-pretty leading-relaxed text-muted-foreground">
              Supervisione provas e aulas práticas no laboratório de informática com segurança e sem distrações.
            </p>
          </div>
          <ul className="flex flex-col gap-4">
            {features.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-background/60 text-primary">
                  <Icon className="size-4" aria-hidden="true" />
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium">{title}</span>
                  <span className="text-sm text-muted-foreground">{text}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-muted-foreground">
          {"© 2026 ArgusEdu · Plataforma de supervisão educativa"}
        </p>
      </section>

      <section className="flex items-center justify-center p-6 sm:p-10">
        <div className="flex w-full max-w-sm flex-col gap-8">
          <div className="flex flex-col gap-2">
            <BrandMark className="mb-4 lg:hidden" />
            <h2 className="text-2xl font-semibold tracking-tight">Entrar</h2>
            <p className="text-sm text-muted-foreground">Use a sua conta Google institucional para continuar.</p>
          </div>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Tipo de acesso
            </legend>
            <div role="radiogroup" aria-label="Tipo de acesso" className="grid grid-cols-2 gap-2">
              {roles.map(({ id, label, hint, icon: Icon }) => {
                const active = role === id
                return (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setRole(id)}
                    className={cn(
                      "flex flex-col items-start gap-2 rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      active ? "border-primary/50 bg-primary/10" : "bg-card hover:bg-accent",
                    )}
                  >
                    <Icon className={cn("size-5", active ? "text-primary" : "text-muted-foreground")} aria-hidden="true" />
                    <span className="flex flex-col">
                      <span className="text-sm font-medium">{label}</span>
                      <span className="text-xs text-muted-foreground">{hint}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          </fieldset>

          <div className="flex flex-col gap-3">
            <Button
              size="lg"
              disabled={isSigningIn}
              onClick={handleGoogleSignIn}
              className="h-12 gap-3 bg-white text-base font-medium text-zinc-900 shadow-sm hover:bg-zinc-100"
            >
              <GoogleIcon className="size-5" />
              {isSigningIn ? "A redirecionar…" : "Entrar com Google"}
            </Button>
            <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <ShieldCheck className="size-3.5 text-primary" aria-hidden="true" />
              Apenas contas do domínio da escola são aceites
            </p>
          </div>
        </div>
      </section>
    </main>
  )
}

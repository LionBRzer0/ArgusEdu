import type { SupabaseClient } from "@supabase/supabase-js"
import { openBroadcastChannel } from "@/lib/realtime-channel"

/**
 * Comandos do professor para os alunos (Supabase Broadcast).
 * Há UM canal por turma: `sala-ao-vivo:cmd:<turmaId>`. Cada mensagem diz a quem se destina
 * (`to` = id de um aluno ou "all"); os alunos ignoram o que não é para eles.
 */
export type Command =
  | { type: "LOCK_SCREEN" } // cobre a página do aluno com um ecrã de bloqueio
  | { type: "UNLOCK_SCREEN" }
  | { type: "NAVIGATE_TO"; url: string } // abre um endereço no navegador do aluno
  | { type: "MESSAGE"; text: string } // aviso visível no ecrã do aluno
  | { type: "END_SESSION" } // sessão terminada: o aluno para de partilhar e sai da sala
  | { type: "REMOVE_STUDENT" } // aluno removido da sala

export type CommandEnvelope = { to: string; command: Command }

export const COMMAND_EVENT = "command"
export const ALL_STUDENTS = "all"

export const commandTopic = (turmaId: string) => `sala-ao-vivo:cmd:${turmaId}`

/**
 * Só aceita endereços http(s). Sem isto, um comando falsificado poderia mandar o aluno para
 * `javascript:...` ou outro esquema perigoso. Aceita "escola.pt/prova" (assume https).
 */
export function safeUrl(raw: string): string | null {
  const text = raw.trim()
  if (!text || /\s/.test(text)) return null
  let candidate = text
  if (!/^https?:\/\//i.test(candidate)) {
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(candidate)) return null // outro esquema (ftp://, file://, …)
    candidate = `https://${candidate}`
  }
  try {
    const url = new URL(candidate)
    if ((url.protocol !== "http:" && url.protocol !== "https:") || !url.hostname) return null
    return url.href
  } catch {
    return null
  }
}

/** Valida o que chega pelo canal: nunca confiamos no formato da mensagem. */
export function parseEnvelope(payload: unknown): CommandEnvelope | null {
  if (typeof payload !== "object" || payload === null) return null
  const { to, command } = payload as { to?: unknown; command?: unknown }
  if (typeof to !== "string" || typeof command !== "object" || command === null) return null
  const c = command as Record<string, unknown>

  switch (c.type) {
    case "LOCK_SCREEN":
    case "UNLOCK_SCREEN":
    case "END_SESSION":
    case "REMOVE_STUDENT":
      return { to, command: { type: c.type } }
    case "NAVIGATE_TO": {
      const url = typeof c.url === "string" ? safeUrl(c.url) : null
      return url ? { to, command: { type: "NAVIGATE_TO", url } } : null
    }
    case "MESSAGE": {
      const text = typeof c.text === "string" ? c.text.trim().slice(0, 500) : ""
      return text ? { to, command: { type: "MESSAGE", text } } : null
    }
    default:
      return null
  }
}

/** Abre o canal, envia UM comando e fecha. Útil fora do painel (por ex. ao apagar uma turma ativa). */
export async function sendCommandOnce(supabase: SupabaseClient, turmaId: string, to: string, command: Command) {
  const channel = await openBroadcastChannel(supabase, commandTopic(turmaId))
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("tempo esgotado")), 4000)
      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          clearTimeout(timer)
          resolve()
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          clearTimeout(timer)
          reject(new Error(status))
        }
      })
    })
    const result = await channel.send({ type: "broadcast", event: COMMAND_EVENT, payload: { to, command } })
    await new Promise((r) => setTimeout(r, 150)) // deixa a mensagem sair antes de fechar o canal
    return result === "ok"
  } catch (error) {
    console.error("Não foi possível enviar o comando", error)
    return false
  } finally {
    await supabase.removeChannel(channel)
  }
}

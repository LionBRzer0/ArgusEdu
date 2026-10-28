import { useCallback, useEffect, useRef, useState } from "react"
import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js"
import { COMMAND_EVENT, commandTopic, type Command } from "@/lib/commands"
import { openBroadcastChannel } from "@/lib/realtime-channel"

/**
 * Lado do professor: mantém o canal de comandos da turma aberto e devolve `send(to, command)`.
 * `to` é o id de um aluno ou ALL_STUDENTS. `send` devolve true se o comando saiu.
 */
export function useTeacherCommands(supabase: SupabaseClient, turmaId: string | null) {
  const channelRef = useRef<RealtimeChannel | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!turmaId) return
    let cancelled = false
    let channel: RealtimeChannel | null = null

    void (async () => {
      const opened = await openBroadcastChannel(supabase, commandTopic(turmaId))
      if (cancelled) {
        void supabase.removeChannel(opened)
        return
      }
      channel = opened
      channelRef.current = opened
      opened.subscribe((status) => {
        if (!cancelled) setReady(status === "SUBSCRIBED")
      })
    })()

    return () => {
      cancelled = true
      channelRef.current = null
      setReady(false)
      if (channel) void supabase.removeChannel(channel)
    }
  }, [supabase, turmaId])

  const send = useCallback(async (to: string, command: Command): Promise<boolean> => {
    const channel = channelRef.current
    if (!channel) return false
    try {
      return (await channel.send({ type: "broadcast", event: COMMAND_EVENT, payload: { to, command } })) === "ok"
    } catch (error) {
      console.error("Falha ao enviar comando", error)
      return false
    }
  }, [])

  return { send, ready }
}

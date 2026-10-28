import type { SupabaseClient } from "@supabase/supabase-js"
import type { Process, Restrictions, Student, StudentSession, StudentStatus, Turma, TurmaListItem } from "@/lib/classroom-data"

type Client = SupabaseClient

// ─── Linhas tal como estão no Supabase (colunas em português) ───────────────

export type TurmaRow = {
  id: string
  nome: string
  codigo: string
  bloquear_navegadores: boolean
  desativar_internet: boolean
  restringir_ia: boolean
  modo_prova: boolean
  sessao_ativa: boolean
  iniciada_em: string
  encerrada_em: string | null
}

export type AlunoRow = {
  id: string
  turma_id: string
  nome: string
  email: string | null
  mesa: string
  estado: StudentStatus
  janela_ativa: string
  ecra: string
  bloqueado: boolean
  navegadores_bloqueados: boolean
  motivo_alerta: string | null
  processos: Process[]
}

const TURMA_COLUMNS =
  "id, nome, codigo, bloquear_navegadores, desativar_internet, restringir_ia, modo_prova, sessao_ativa, iniciada_em, encerrada_em"

const ALUNO_COLUMNS =
  "id, turma_id, nome, email, mesa, estado, janela_ativa, ecra, bloqueado, navegadores_bloqueados, motivo_alerta, processos"

// ─── Conversões linha ⇄ tipos da app ────────────────────────────────────────

export function rowToTurma(row: TurmaRow): Turma {
  return {
    id: row.id,
    name: row.nome,
    code: row.codigo,
    restrictions: {
      blockBrowsers: row.bloquear_navegadores,
      disableInternet: row.desativar_internet,
      restrictAI: row.restringir_ia,
    },
    examMode: row.modo_prova,
    active: row.sessao_ativa,
    startedAt: row.iniciada_em,
    endedAt: row.encerrada_em,
  }
}

export function rowToStudent(row: AlunoRow): Student {
  return {
    id: row.id,
    name: row.nome,
    desk: row.mesa,
    status: row.estado,
    activeWindow: row.janela_ativa,
    screen: row.ecra,
    locked: row.bloqueado,
    browsersBlocked: row.navegadores_bloqueados,
    alertReason: row.motivo_alerta ?? undefined,
    processes: Array.isArray(row.processos) ? row.processos : [],
  }
}

function studentPatchToRow(patch: Partial<Student>): Partial<AlunoRow> {
  const row: Partial<AlunoRow> = {}
  if ("name" in patch) row.nome = patch.name
  if ("desk" in patch) row.mesa = patch.desk
  if ("status" in patch) row.estado = patch.status
  if ("activeWindow" in patch) row.janela_ativa = patch.activeWindow
  if ("screen" in patch) row.ecra = patch.screen
  if ("locked" in patch) row.bloqueado = patch.locked
  if ("browsersBlocked" in patch) row.navegadores_bloqueados = patch.browsersBlocked
  if ("alertReason" in patch) row.motivo_alerta = patch.alertReason ?? null
  if ("processes" in patch) row.processos = patch.processes
  return row
}

// ─── Utilitários ────────────────────────────────────────────────────────────

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

export function randomCode() {
  const chars = Array.from({ length: 6 }, () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)])
  return `${chars.slice(0, 3).join("")}-${chars.slice(3).join("")}`
}

/** Mesas em filas de 4: A1–A4, B1–B4, … */
export function deskFor(index: number) {
  return `${String.fromCharCode(65 + Math.floor(index / 4))}${(index % 4) + 1}`
}

// ─── Leitura ────────────────────────────────────────────────────────────────

/** Devolve a turma pedida; sem `id`, a sessão ativa mais recente (ou a última criada). */
export async function fetchTurma(supabase: Client, id?: string): Promise<Turma | null> {
  let query = supabase.from("turmas").select(TURMA_COLUMNS)
  query = id
    ? query.eq("id", id)
    : query.order("sessao_ativa", { ascending: false }).order("created_at", { ascending: false })
  const { data, error } = await query.limit(1).maybeSingle()
  if (error) throw error
  return data ? rowToTurma(data as unknown as TurmaRow) : null
}

export async function fetchStudents(supabase: Client, turmaId: string): Promise<Student[]> {
  const { data, error } = await supabase.from("alunos").select(ALUNO_COLUMNS).eq("turma_id", turmaId).order("mesa")
  if (error) throw error
  return ((data ?? []) as unknown as AlunoRow[]).map(rowToStudent)
}

// ─── Escrita ────────────────────────────────────────────────────────────────

type NewTurma = {
  name: string
  code: string
  restrictions: Restrictions
  roster: { name: string; email: string }[]
}

/** Cria a turma e a lista de alunos. Se o código já existir, gera outro. */
export async function createTurma(supabase: Client, input: NewTurma): Promise<Turma> {
  let code = input.code
  let turma: Turma | undefined

  for (let attempt = 0; attempt < 5; attempt++) {
    const { data, error } = await supabase
      .from("turmas")
      .insert({
        nome: input.name,
        codigo: code,
        bloquear_navegadores: input.restrictions.blockBrowsers,
        desativar_internet: input.restrictions.disableInternet,
        restringir_ia: input.restrictions.restrictAI,
        modo_prova: input.restrictions.blockBrowsers,
      })
      .select(TURMA_COLUMNS)
      .single()

    if (!error) {
      turma = rowToTurma(data as unknown as TurmaRow)
      break
    }
    if (error.code !== "23505") throw error // 23505 = código de sala repetido
    code = randomCode()
  }

  if (!turma) throw new Error("Não foi possível gerar um código de sala único. Tente novamente.")
  const created = turma

  if (input.roster.length > 0) {
    const rows = input.roster.map((s, i) => ({
      turma_id: created.id,
      nome: s.name,
      email: s.email || null,
      mesa: deskFor(i),
    }))
    const { error } = await supabase.from("alunos").insert(rows)
    if (error) {
      await supabase.from("turmas").delete().eq("id", created.id) // não deixa uma turma vazia a meio
      throw error
    }
  }

  return created
}

export async function updateStudent(supabase: Client, id: string, patch: Partial<Student>) {
  const row = studentPatchToRow(patch)
  if (Object.keys(row).length === 0) return
  const { error } = await supabase.from("alunos").update(row).eq("id", id)
  if (error) throw error
}

export async function deleteStudent(supabase: Client, id: string) {
  const { error } = await supabase.from("alunos").delete().eq("id", id)
  if (error) throw error
}

/** Liga/desliga o Modo Prova; ao ligar, bloqueia navegadores em todas as estações ligadas. */
export async function saveExamMode(supabase: Client, turmaId: string, value: boolean) {
  const { error } = await supabase.from("turmas").update({ modo_prova: value }).eq("id", turmaId)
  if (error) throw error
  if (!value) return
  const { error: studentsError } = await supabase
    .from("alunos")
    .update({ navegadores_bloqueados: true })
    .eq("turma_id", turmaId)
    .neq("estado", "offline")
  if (studentsError) throw studentsError
}

/** Encerra a sessão e desliga todas as estações. */
export async function saveEndSession(supabase: Client, turmaId: string, endedAt: string) {
  const { error } = await supabase
    .from("turmas")
    .update({ sessao_ativa: false, modo_prova: false, encerrada_em: endedAt })
    .eq("id", turmaId)
  if (error) throw error
  const { error: studentsError } = await supabase
    .from("alunos")
    .update({
      estado: "offline",
      janela_ativa: "Desconectado",
      ecra: "",
      bloqueado: false,
      motivo_alerta: null,
      processos: [],
    })
    .eq("turma_id", turmaId)
  if (studentsError) throw studentsError
}

// ─── Lado do aluno (funções seguras no Supabase; o aluno não acede às tabelas) ──

type JoinRow = {
  out_turma_id: string
  out_turma_nome: string
  out_aluno_id: string
  out_aluno_nome: string
  out_mesa: string
  out_bloqueado: boolean
}

/** Entra numa turma com o código de sala. Liga a conta do aluno à sua linha em `alunos` e marca-o online. */
export async function joinTurma(supabase: Client, code: string): Promise<StudentSession> {
  const { data, error } = await supabase.rpc("entrar_na_turma", { p_codigo: code })
  if (error) throw error
  const row = (data as JoinRow[] | null)?.[0]
  if (!row) throw new Error("Não foi possível entrar na turma.")
  return {
    turmaId: row.out_turma_id,
    turmaName: row.out_turma_nome,
    studentId: row.out_aluno_id,
    name: row.out_aluno_nome,
    desk: row.out_mesa,
    locked: row.out_bloqueado,
  }
}

/** Marca como offline as estações deste aluno. */
export async function leaveTurma(supabase: Client) {
  const { error } = await supabase.rpc("sair_da_turma")
  if (error) throw error
}

/** O aluno indica se está a partilhar o ecrã (aparece no cartão do professor). */
export async function setSharing(supabase: Client, active: boolean) {
  const { error } = await supabase.rpc("definir_partilha", { p_ativa: active })
  if (error) throw error
}

// ─── Salas guardadas: reabrir e apagar ──────────────────────────────────────

/** Todas as turmas do professor (as ativas primeiro). */
export async function fetchTurmas(supabase: Client): Promise<TurmaListItem[]> {
  const { data, error } = await supabase
    .from("turmas")
    .select(`${TURMA_COLUMNS}, alunos(count)`)
    .order("sessao_ativa", { ascending: false })
    .order("created_at", { ascending: false })
  if (error) throw error
  return ((data ?? []) as unknown as (TurmaRow & { alunos: { count: number }[] })[]).map((row) => ({
    ...rowToTurma(row),
    studentCount: row.alunos?.[0]?.count ?? 0,
  }))
}

/** Volta a abrir uma sala encerrada, com o mesmo código. O cronómetro recomeça. */
export async function reopenTurma(supabase: Client, id: string): Promise<Turma> {
  const { data, error } = await supabase
    .from("turmas")
    .update({ sessao_ativa: true, encerrada_em: null, iniciada_em: new Date().toISOString(), modo_prova: false })
    .eq("id", id)
    .select(TURMA_COLUMNS)
    .single()
  if (error) throw error
  return rowToTurma(data as unknown as TurmaRow)
}

/** Apaga a turma e (em cascata) todos os seus alunos. */
export async function deleteTurma(supabase: Client, id: string) {
  const { error } = await supabase.from("turmas").delete().eq("id", id)
  if (error) throw error
}

/** Apaga todas as turmas já encerradas. */
export async function deleteClosedTurmas(supabase: Client) {
  const { error } = await supabase.from("turmas").delete().eq("sessao_ativa", false)
  if (error) throw error
}

/** Bloqueia/desbloqueia todas as estações ligadas. */
export async function saveLockAll(supabase: Client, turmaId: string, locked: boolean) {
  const { error } = await supabase
    .from("alunos")
    .update({ bloqueado: locked })
    .eq("turma_id", turmaId)
    .neq("estado", "offline")
  if (error) throw error
}

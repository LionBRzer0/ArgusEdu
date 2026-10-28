export type StudentStatus = "online" | "alert" | "offline"

export type Process = {
  pid: number
  name: string
  cpu: number
  memoryMb: number
  flagged?: boolean
}

export type Restrictions = {
  blockBrowsers: boolean
  disableInternet: boolean
  restrictAI: boolean
}

export type Turma = {
  id: string
  name: string
  code: string
  restrictions: Restrictions
  examMode: boolean
  active: boolean
  startedAt: string
  endedAt: string | null
}

/** Dados do aluno depois de entrar numa turma com o código de sala. */
export type StudentSession = {
  turmaId: string
  turmaName: string
  studentId: string
  name: string
  desk: string
  locked: boolean
}

/** Turma + número de alunos, para a lista de salas guardadas. */
export type TurmaListItem = Turma & { studentCount: number }

export type Student = {
  id: string
  name: string
  desk: string
  status: StudentStatus
  activeWindow: string
  screen: string
  locked: boolean
  browsersBlocked: boolean
  alertReason?: string
  processes: Process[]
}

export function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

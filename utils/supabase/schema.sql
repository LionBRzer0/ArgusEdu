-- ArgusEdu · tabelas `turmas` e `alunos`
-- Cole e execute no Supabase → SQL Editor.

-- ─────────────────────────────────────────────────────────────
-- 1. TURMAS (uma sessão de aula/prova de um professor)
-- ─────────────────────────────────────────────────────────────
create table public.turmas (
  id                    uuid primary key default gen_random_uuid(),
  professor_id          uuid not null default auth.uid()
                          references auth.users (id) on delete cascade,
  nome                  text not null check (char_length(btrim(nome)) > 0),
  codigo                text not null unique,          -- código de sala, ex.: K7X-92Q
  bloquear_navegadores  boolean not null default false,
  desativar_internet    boolean not null default false,
  restringir_ia         boolean not null default false,
  modo_prova            boolean not null default false,
  sessao_ativa          boolean not null default true,
  iniciada_em           timestamptz not null default now(),
  encerrada_em          timestamptz,
  created_at            timestamptz not null default now()
);

create index turmas_professor_idx on public.turmas (professor_id, created_at desc);

-- ─────────────────────────────────────────────────────────────
-- 2. ALUNOS (uma estação/mesa dentro de uma turma)
-- ─────────────────────────────────────────────────────────────
create table public.alunos (
  id                      uuid primary key default gen_random_uuid(),
  turma_id                uuid not null references public.turmas (id) on delete cascade,
  nome                    text not null check (char_length(btrim(nome)) > 0),
  email                   text,
  mesa                    text not null,                -- ex.: A1, B3
  estado                  text not null default 'offline'
                            check (estado in ('online', 'alert', 'offline')),
  janela_ativa            text not null default 'Sem conexão',
  ecra                    text not null default '',     -- URL da pré-visualização do ecrã
  bloqueado               boolean not null default false,
  navegadores_bloqueados  boolean not null default false,
  motivo_alerta           text,
  processos               jsonb not null default '[]'::jsonb,
                          -- [{ "pid": 412, "name": "chrome.exe", "cpu": 9.8, "memoryMb": 688, "flagged": true }]
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  unique (turma_id, mesa)
);

create index alunos_turma_idx on public.alunos (turma_id);

-- Mesmo email só uma vez por turma (ignora vazios)
create unique index alunos_turma_email_key
  on public.alunos (turma_id, lower(email))
  where email is not null and email <> '';

-- Atualiza `updated_at` automaticamente
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger alunos_set_updated_at
  before update on public.alunos
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────
-- 3. SEGURANÇA (RLS) — cada professor só vê e altera o que é seu
-- ─────────────────────────────────────────────────────────────
alter table public.turmas enable row level security;
alter table public.alunos enable row level security;

grant select, insert, update, delete on public.turmas, public.alunos to authenticated;

create policy "Professor gere as suas turmas"
  on public.turmas
  for all
  to authenticated
  using (professor_id = (select auth.uid()))
  with check (professor_id = (select auth.uid()));

create policy "Professor gere os alunos das suas turmas"
  on public.alunos
  for all
  to authenticated
  using (
    exists (
      select 1 from public.turmas t
      where t.id = alunos.turma_id
        and t.professor_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.turmas t
      where t.id = alunos.turma_id
        and t.professor_id = (select auth.uid())
    )
  );

-- ─────────────────────────────────────────────────────────────
-- 4. REALTIME — o painel recebe alterações dos alunos ao vivo
-- ─────────────────────────────────────────────────────────────
do $$
begin
  alter publication supabase_realtime add table public.alunos;
exception
  when duplicate_object then null;
end;
$$;

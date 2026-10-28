-- ArgusEdu · entrada dos alunos por código de sala
-- Execute no SQL Editor DEPOIS do schema.sql. Pode ser executado mais de uma vez.
--
-- O aluno não tem acesso direto às tabelas (RLS). Em vez disso chama a função
-- `entrar_na_turma(código)`, que corre com permissões elevadas mas só faz o necessário:
-- valida o código, liga a conta Google do aluno a uma linha de `alunos` e marca-o online.

-- 1. Ligação entre a conta do aluno e a linha em `alunos`
alter table public.alunos
  add column if not exists user_id uuid references auth.users (id) on delete set null;

create unique index if not exists alunos_turma_user_key
  on public.alunos (turma_id, user_id)
  where user_id is not null;

-- 2. Entrar na turma
create or replace function public.entrar_na_turma(p_codigo text)
returns table (
  out_turma_id   uuid,
  out_turma_nome text,
  out_aluno_id   uuid,
  out_aluno_nome text,
  out_mesa       text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid        uuid := auth.uid();
  v_email      text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_nome       text := coalesce(
                         nullif(btrim(auth.jwt() -> 'user_metadata' ->> 'full_name'), ''),
                         nullif(btrim(auth.jwt() -> 'user_metadata' ->> 'name'), ''),
                         nullif(auth.jwt() ->> 'email', ''),
                         'Aluno'
                       );
  v_turma      public.turmas%rowtype;
  v_aluno      public.alunos%rowtype;
  v_ok         boolean;
  v_i          int := 0;
  v_mesa       text;
  v_constraint text;
begin
  if v_uid is null then
    raise exception 'Inicie sessão para entrar numa turma.' using errcode = '28000';
  end if;

  -- Aceita "K7X-92Q", "k7x92q", etc.
  select * into v_turma
    from public.turmas t
   where replace(t.codigo, '-', '') = upper(regexp_replace(coalesce(p_codigo, ''), '[^A-Za-z0-9]', '', 'g'))
     and t.sessao_ativa;
  if not found then
    raise exception 'Código inválido ou sessão já terminada.' using errcode = 'P0002';
  end if;

  -- a) este aluno já entrou antes nesta turma?
  select * into v_aluno
    from public.alunos a
   where a.turma_id = v_turma.id and a.user_id = v_uid;
  v_ok := found;

  -- b) o professor tinha-o na lista com o mesmo email?
  if not v_ok and v_email <> '' then
    select * into v_aluno
      from public.alunos a
     where a.turma_id = v_turma.id and a.user_id is null and lower(a.email) = v_email
     limit 1;
    v_ok := found;
    if v_ok then
      update public.alunos set user_id = v_uid where id = v_aluno.id;
    end if;
  end if;

  -- c) aluno novo: primeira mesa livre (A1, A2, A3, A4, B1, …)
  if not v_ok then
    loop
      if v_i > 500 then
        raise exception 'Não há mesas livres nesta turma.' using errcode = 'P0001';
      end if;
      v_mesa := chr(65 + v_i / 4) || ((v_i % 4) + 1)::text;

      if not exists (select 1 from public.alunos a where a.turma_id = v_turma.id and a.mesa = v_mesa) then
        begin
          insert into public.alunos (turma_id, user_id, nome, email, mesa)
          values (v_turma.id, v_uid, v_nome, nullif(v_email, ''), v_mesa)
          returning * into v_aluno;
          exit;
        exception when unique_violation then
          -- Só tentamos a mesa seguinte se outro aluno ficou com esta ao mesmo tempo
          get stacked diagnostics v_constraint = constraint_name;
          if v_constraint is distinct from 'alunos_turma_id_mesa_key' then
            raise;
          end if;
        end;
      end if;

      v_i := v_i + 1;
    end loop;
  end if;

  update public.alunos
     set estado = 'online',
         janela_ativa = 'Ligado — a aguardar o monitoramento',
         ecra = '',
         motivo_alerta = null
   where id = v_aluno.id
  returning * into v_aluno;

  return query select v_turma.id, v_turma.nome, v_aluno.id, v_aluno.nome, v_aluno.mesa;
end;
$$;

-- 3. Sair da turma (marca as estações deste aluno como offline)
create or replace function public.sair_da_turma()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.alunos
     set estado = 'offline',
         janela_ativa = 'Desconectado',
         ecra = '',
         bloqueado = false,
         motivo_alerta = null,
         processos = '[]'::jsonb
   where user_id = (select auth.uid());
$$;

-- Só utilizadores com sessão iniciada podem chamar as funções
revoke all on function public.entrar_na_turma(text) from public, anon;
revoke all on function public.sair_da_turma() from public, anon;
grant execute on function public.entrar_na_turma(text) to authenticated;
grant execute on function public.sair_da_turma() to authenticated;

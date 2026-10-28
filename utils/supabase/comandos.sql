-- ArgusEdu · comandos em tempo real e estado da partilha
-- Execute no SQL Editor DEPOIS de schema.sql e entrada-alunos.sql. Pode ser repetido.

-- 1. `entrar_na_turma` passa a devolver também se o aluno está bloqueado.
--    (O tipo de retorno mudou, por isso a função antiga tem de ser apagada primeiro.)
drop function if exists public.entrar_na_turma(text);

create function public.entrar_na_turma(p_codigo text)
returns table (
  out_turma_id   uuid,
  out_turma_nome text,
  out_aluno_id   uuid,
  out_aluno_nome text,
  out_mesa       text,
  out_bloqueado  boolean
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

  select * into v_turma
    from public.turmas t
   where replace(t.codigo, '-', '') = upper(regexp_replace(coalesce(p_codigo, ''), '[^A-Za-z0-9]', '', 'g'))
     and t.sessao_ativa;
  if not found then
    raise exception 'Código inválido ou sessão já terminada.' using errcode = 'P0002';
  end if;

  select * into v_aluno
    from public.alunos a
   where a.turma_id = v_turma.id and a.user_id = v_uid;
  v_ok := found;

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
         janela_ativa = 'Ligado — sem partilha de ecrã',
         ecra = '',
         motivo_alerta = null
   where id = v_aluno.id
  returning * into v_aluno;

  return query select v_turma.id, v_turma.nome, v_aluno.id, v_aluno.nome, v_aluno.mesa, v_aluno.bloqueado;
end;
$$;

revoke all on function public.entrar_na_turma(text) from public, anon;
grant execute on function public.entrar_na_turma(text) to authenticated;

-- 2. O aluno indica se está a partilhar o ecrã (aparece no cartão do painel do professor)
create or replace function public.definir_partilha(p_ativa boolean)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.alunos
     set janela_ativa = case when p_ativa then 'A partilhar o ecrã'
                             else 'Ligado — sem partilha de ecrã' end
   where user_id = (select auth.uid())
     and estado <> 'offline';
$$;

revoke all on function public.definir_partilha(boolean) from public, anon;
grant execute on function public.definir_partilha(boolean) to authenticated;

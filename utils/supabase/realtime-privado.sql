-- ArgusEdu · canais de Realtime PRIVADOS (opcional, recomendado antes de usar com alunos reais)
--
-- Por omissão os canais de sinalização e de comandos são públicos: quem tiver a chave `anon` e souber
-- os IDs poderia enviar comandos ou espiar a ligação. Este script cria as regras que decidem quem
-- pode ouvir e enviar em cada canal:
--
--   sala-ao-vivo:cmd:<turma>        professor da turma: ouve e envia | alunos da turma: só ouvem
--   sala-ao-vivo:<turma>:<aluno>    professor da turma e o próprio aluno: ouvem e enviam
--
-- Como ativar: 1) execute este script;  2) ponha NEXT_PUBLIC_REALTIME_PRIVATE=true no .env.local
-- (e na Vercel) e reinicie a app. Para desativar, apague essa variável.

create or replace function public.sala_ao_vivo_autorizado(p_topic text, p_enviar boolean)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uuid constant text := '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
  v_uid   uuid := auth.uid();
  v_parts text[] := string_to_array(coalesce(p_topic, ''), ':');
  v_turma uuid;
  v_aluno uuid;
begin
  if v_uid is null or v_parts[1] is distinct from 'sala-ao-vivo' then
    return false;
  end if;

  -- Comandos do professor para a turma
  if v_parts[2] = 'cmd' then
    if v_parts[3] is null or v_parts[3] !~ v_uuid then
      return false;
    end if;
    v_turma := v_parts[3]::uuid;
    if exists (select 1 from public.turmas t where t.id = v_turma and t.professor_id = v_uid) then
      return true;
    end if;
    return (not p_enviar) and exists (
      select 1 from public.alunos a where a.turma_id = v_turma and a.user_id = v_uid
    );
  end if;

  -- Sinalização WebRTC de um aluno
  if v_parts[2] is null or v_parts[2] !~ v_uuid or v_parts[3] is null or v_parts[3] !~ v_uuid then
    return false;
  end if;
  v_turma := v_parts[2]::uuid;
  v_aluno := v_parts[3]::uuid;

  return exists (select 1 from public.turmas t where t.id = v_turma and t.professor_id = v_uid)
      or exists (select 1 from public.alunos a where a.id = v_aluno and a.turma_id = v_turma and a.user_id = v_uid);
end;
$$;

revoke all on function public.sala_ao_vivo_autorizado(text, boolean) from public, anon;
grant execute on function public.sala_ao_vivo_autorizado(text, boolean) to authenticated;

drop policy if exists "sala-ao-vivo: ouvir" on realtime.messages;
create policy "sala-ao-vivo: ouvir"
  on realtime.messages
  for select
  to authenticated
  using (
    realtime.messages.extension = 'broadcast'
    and public.sala_ao_vivo_autorizado((select realtime.topic()), false)
  );

drop policy if exists "sala-ao-vivo: enviar" on realtime.messages;
create policy "sala-ao-vivo: enviar"
  on realtime.messages
  for insert
  to authenticated
  with check (
    realtime.messages.extension = 'broadcast'
    and public.sala_ao_vivo_autorizado((select realtime.topic()), true)
  );

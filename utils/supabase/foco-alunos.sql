-- ArgusEdu · aviso ao professor quando o aluno sai da janela do ArgusEdu
-- Execute no SQL Editor DEPOIS de comandos.sql. Pode ser repetido.
--
-- O aluno não acede às tabelas diretamente: a página chama `definir_foco(true/false)` quando
-- a janela do ArgusEdu ganha ou perde o foco. Fora da janela, o cartão do aluno fica em alerta
-- no painel do professor; ao voltar, o alerta desaparece.

create or replace function public.definir_foco(p_focado boolean)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.alunos
     set estado        = case when p_focado then 'online' else 'alert' end,
         motivo_alerta = case when p_focado then null else 'Saiu da janela do ArgusEdu' end
   where user_id = (select auth.uid())
     and estado <> 'offline';
$$;

revoke all on function public.definir_foco(boolean) from public, anon;
grant execute on function public.definir_foco(boolean) to authenticated;

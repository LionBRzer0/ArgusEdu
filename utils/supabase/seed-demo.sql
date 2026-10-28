-- ArgusEdu · dados de demonstração (OPCIONAL)
-- Cria a turma "Lab 204 · Algoritmos II" com 16 alunos, iguais aos dados simulados antigos.
-- 1) Entre uma vez na app com a sua conta Google (para o utilizador existir).
-- 2) Troque o email abaixo pelo dessa conta e execute no SQL Editor.

do $$
declare
  v_email text := 'o.seu.email@gmail.com';
  v_prof  uuid;
  v_turma uuid;
begin
  select id into v_prof from auth.users where email = v_email;
  if v_prof is null then
    raise exception 'Nenhum utilizador com o email %. Inicie sessão na app primeiro.', v_email;
  end if;

  insert into public.turmas (professor_id, nome, codigo, bloquear_navegadores, restringir_ia)
  values (v_prof, 'Lab 204 · Algoritmos II', 'DEM-024', false, false)
  returning id into v_turma;

  insert into public.alunos
    (turma_id, nome, mesa, estado, janela_ativa, ecra, bloqueado, navegadores_bloqueados, motivo_alerta, processos)
  values
    (v_turma, 'João Silva', 'A1', 'online', 'main.py — Visual Studio Code', '/screens/vscode.png', false, false, null, '[{"pid":5120,"name":"Code.exe","cpu":6.3,"memoryMb":412},{"pid":5188,"name":"python.exe","cpu":12.1,"memoryMb":96},{"pid":412,"name":"explorer.exe","cpu":1.2,"memoryMb":84},{"pid":1088,"name":"argus-agent.exe","cpu":0.4,"memoryMb":32},{"pid":2231,"name":"svchost.exe","cpu":0.8,"memoryMb":46}]'::jsonb),
    (v_turma, 'Maria Oliveira', 'A2', 'online', 'Prova Final — Algoritmos II', '/screens/quiz.png', false, false, null, '[{"pid":6044,"name":"chrome.exe","cpu":9.8,"memoryMb":688},{"pid":6071,"name":"chrome.exe --type=renderer","cpu":4.1,"memoryMb":214},{"pid":412,"name":"explorer.exe","cpu":1.2,"memoryMb":84},{"pid":1088,"name":"argus-agent.exe","cpu":0.4,"memoryMb":32},{"pid":2231,"name":"svchost.exe","cpu":0.8,"memoryMb":46}]'::jsonb),
    (v_turma, 'Pedro Santos', 'A3', 'alert', 'Gameplay ao vivo — Streaming', '/screens/video.png', false, false, 'Site não permitido detectado', '[{"pid":6044,"name":"chrome.exe","cpu":9.8,"memoryMb":688,"flagged":true},{"pid":6071,"name":"chrome.exe --type=renderer","cpu":4.1,"memoryMb":214,"flagged":true},{"pid":412,"name":"explorer.exe","cpu":1.2,"memoryMb":84},{"pid":1088,"name":"argus-agent.exe","cpu":0.4,"memoryMb":32},{"pid":2231,"name":"svchost.exe","cpu":0.8,"memoryMb":46}]'::jsonb),
    (v_turma, 'Ana Costa', 'A4', 'online', 'Redes de Computadores.docx', '/screens/docs.png', false, false, null, '[{"pid":7002,"name":"WINWORD.EXE","cpu":3.4,"memoryMb":256},{"pid":412,"name":"explorer.exe","cpu":1.2,"memoryMb":84},{"pid":1088,"name":"argus-agent.exe","cpu":0.4,"memoryMb":32},{"pid":2231,"name":"svchost.exe","cpu":0.8,"memoryMb":46}]'::jsonb),
    (v_turma, 'Lucas Pereira', 'B1', 'online', 'bash — gcc -o lista3 lista3.c', '/screens/terminal.png', false, true, null, '[{"pid":3310,"name":"WindowsTerminal.exe","cpu":2.2,"memoryMb":118},{"pid":3355,"name":"gcc.exe","cpu":18.4,"memoryMb":74},{"pid":412,"name":"explorer.exe","cpu":1.2,"memoryMb":84},{"pid":1088,"name":"argus-agent.exe","cpu":0.4,"memoryMb":32},{"pid":2231,"name":"svchost.exe","cpu":0.8,"memoryMb":46}]'::jsonb),
    (v_turma, 'Beatriz Almeida', 'B2', 'online', 'Prova Final — Algoritmos II', '/screens/quiz.png', false, false, null, '[{"pid":6044,"name":"chrome.exe","cpu":9.8,"memoryMb":688},{"pid":6071,"name":"chrome.exe --type=renderer","cpu":4.1,"memoryMb":214},{"pid":412,"name":"explorer.exe","cpu":1.2,"memoryMb":84},{"pid":1088,"name":"argus-agent.exe","cpu":0.4,"memoryMb":32},{"pid":2231,"name":"svchost.exe","cpu":0.8,"memoryMb":46}]'::jsonb),
    (v_turma, 'Gabriel Rocha', 'B3', 'offline', 'Sem conexão', '', false, false, null, '[]'::jsonb),
    (v_turma, 'Juliana Lima', 'B4', 'online', 'main.py — Visual Studio Code', '/screens/vscode.png', false, false, null, '[{"pid":5120,"name":"Code.exe","cpu":6.3,"memoryMb":412},{"pid":5188,"name":"python.exe","cpu":12.1,"memoryMb":96},{"pid":412,"name":"explorer.exe","cpu":1.2,"memoryMb":84},{"pid":1088,"name":"argus-agent.exe","cpu":0.4,"memoryMb":32},{"pid":2231,"name":"svchost.exe","cpu":0.8,"memoryMb":46}]'::jsonb),
    (v_turma, 'Rafael Souza', 'C1', 'alert', 'Mensagens — Web Chat', '/screens/chat.png', false, false, 'Aplicativo de mensagens em uso', '[{"pid":6044,"name":"chrome.exe","cpu":9.8,"memoryMb":688,"flagged":true},{"pid":6071,"name":"chrome.exe --type=renderer","cpu":4.1,"memoryMb":214,"flagged":true},{"pid":412,"name":"explorer.exe","cpu":1.2,"memoryMb":84},{"pid":1088,"name":"argus-agent.exe","cpu":0.4,"memoryMb":32},{"pid":2231,"name":"svchost.exe","cpu":0.8,"memoryMb":46}]'::jsonb),
    (v_turma, 'Camila Ribeiro', 'C2', 'online', 'Redes de Computadores.docx', '/screens/docs.png', false, false, null, '[{"pid":7002,"name":"WINWORD.EXE","cpu":2.9,"memoryMb":241},{"pid":412,"name":"explorer.exe","cpu":1.2,"memoryMb":84},{"pid":1088,"name":"argus-agent.exe","cpu":0.4,"memoryMb":32},{"pid":2231,"name":"svchost.exe","cpu":0.8,"memoryMb":46}]'::jsonb),
    (v_turma, 'Thiago Martins', 'C3', 'online', 'bash — make test', '/screens/terminal.png', true, true, null, '[{"pid":3310,"name":"WindowsTerminal.exe","cpu":1.1,"memoryMb":102},{"pid":412,"name":"explorer.exe","cpu":1.2,"memoryMb":84},{"pid":1088,"name":"argus-agent.exe","cpu":0.4,"memoryMb":32},{"pid":2231,"name":"svchost.exe","cpu":0.8,"memoryMb":46}]'::jsonb),
    (v_turma, 'Larissa Gomes', 'C4', 'online', 'Prova Final — Algoritmos II', '/screens/quiz.png', false, false, null, '[{"pid":6044,"name":"chrome.exe","cpu":9.8,"memoryMb":688},{"pid":6071,"name":"chrome.exe --type=renderer","cpu":4.1,"memoryMb":214},{"pid":412,"name":"explorer.exe","cpu":1.2,"memoryMb":84},{"pid":1088,"name":"argus-agent.exe","cpu":0.4,"memoryMb":32},{"pid":2231,"name":"svchost.exe","cpu":0.8,"memoryMb":46}]'::jsonb),
    (v_turma, 'Mateus Carvalho', 'D1', 'online', 'main.py — Visual Studio Code', '/screens/vscode.png', false, false, null, '[{"pid":5120,"name":"Code.exe","cpu":6.3,"memoryMb":412},{"pid":5188,"name":"python.exe","cpu":12.1,"memoryMb":96},{"pid":412,"name":"explorer.exe","cpu":1.2,"memoryMb":84},{"pid":1088,"name":"argus-agent.exe","cpu":0.4,"memoryMb":32},{"pid":2231,"name":"svchost.exe","cpu":0.8,"memoryMb":46}]'::jsonb),
    (v_turma, 'Fernanda Dias', 'D2', 'online', 'Prova Final — Algoritmos II', '/screens/quiz.png', false, false, null, '[{"pid":6044,"name":"chrome.exe","cpu":9.8,"memoryMb":688},{"pid":6071,"name":"chrome.exe --type=renderer","cpu":4.1,"memoryMb":214},{"pid":412,"name":"explorer.exe","cpu":1.2,"memoryMb":84},{"pid":1088,"name":"argus-agent.exe","cpu":0.4,"memoryMb":32},{"pid":2231,"name":"svchost.exe","cpu":0.8,"memoryMb":46}]'::jsonb),
    (v_turma, 'Bruno Araújo', 'D3', 'online', 'Redes de Computadores.docx', '/screens/docs.png', false, false, null, '[{"pid":7002,"name":"WINWORD.EXE","cpu":4.0,"memoryMb":270},{"pid":412,"name":"explorer.exe","cpu":1.2,"memoryMb":84},{"pid":1088,"name":"argus-agent.exe","cpu":0.4,"memoryMb":32},{"pid":2231,"name":"svchost.exe","cpu":0.8,"memoryMb":46}]'::jsonb),
    (v_turma, 'Isabela Nunes', 'D4', 'online', 'bash — python3 -m pytest', '/screens/terminal.png', false, false, null, '[{"pid":3310,"name":"WindowsTerminal.exe","cpu":1.6,"memoryMb":110},{"pid":412,"name":"explorer.exe","cpu":1.2,"memoryMb":84},{"pid":1088,"name":"argus-agent.exe","cpu":0.4,"memoryMb":32},{"pid":2231,"name":"svchost.exe","cpu":0.8,"memoryMb":46}]'::jsonb);
end;
$$;

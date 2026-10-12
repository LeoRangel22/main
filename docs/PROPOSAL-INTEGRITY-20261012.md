# Integridade de propostas e revisão de envio — 12/10/2026

## Correções

A gravação usa uma cópia independente do conteúdo e a revisão original da proposta. Apenas uma gravação do editor pode ocorrer de cada vez; troca de evento é bloqueada enquanto ela está em andamento. Alterações digitadas durante a espera permanecem locais e são sinalizadas como não salvas. Um retorno vazio, incoerente ou uma falha de transporte não produz confirmação falsa de sucesso. A gravação posterior mantém a identidade do registro.

A reabertura mantém itens, preços, condições, observações e anexos. Um foco automático tardio não pode transferir a digitação de outro campo para o nome do cliente.

O e-mail integrado exige a prévia integral gerada pelo servidor: HTML isolado em iframe sem scripts, texto, assunto, destinatário e remetente. Uma assinatura SHA-256 vincula o conteúdo revisado ao payload efetivamente enviado. Alterações no texto, assunto, destinatário, itens, remetente ou revisão invalidam a aprovação. A prévia não envia mensagens nem cria registros no outbox.

As duas assinaturas antigas de `begin_event_send` não podem mais ser executadas por clientes autenticados. O acesso da equipe permanece apenas no wrapper que confere a revisão sob bloqueio da linha.

## Evidência antes da publicação

O workflow de reparo 38274805510 concluiu a aplicação e as suítes de aplicação, navegador e PostgreSQL com sucesso. O pacote tem 109 testes Node e 116 testes de navegador, incluindo regressões de gravação concorrente, falha de resposta, reabertura, foco e aprovação integral de e-mail. A suíte normal de PR deve passar novamente sobre o commit final sem os arquivos temporários de reparo.

Em produção, o teste transacional com papel `authenticated` verificou criação, edição, leitura posterior, sincronização de oportunidade, conflito de revisão, bloqueio de resumo incompleto, criação de rascunho, publicação e permissões de envio. Tudo foi revertido por ROLLBACK: 191 propostas preservadas, zero registros de teste remanescentes e seis registros preexistentes no outbox. Nenhuma mensagem foi enviada.

Auditoria das 191 propostas: nenhum snapshot vazio, revisão inválida, proposta sem oportunidade ou grupo com mais de uma versão atual. A conferência de total e data não encontrou divergências entre colunas e snapshot. Dois registros antigos cancelados têm campos incompletos (um sem itens e outro com nome genérico); foram preservados, sem inventar dados.

## Implantação e limites

A migração já aplicada em produção tem versão `20261012160537_proposal_review_integrity.sql`; o nome no repositório acompanha o ledger efetivo. O emissor `send-proposal-email` deve ser implantado junto ao frontend, preservando `verify_jwt = true` e as verificações de usuário/equipe. As Edge Functions não são automaticamente publicadas pelo GitHub Pages.

O workflow de verificação pública confere o commit e schema do `release.json`, hashes de todos os assets, ausência de arquivos internos, proteção anônima do emissor e carregamento da tela de acesso. Ele não envia comunicações nem altera propostas.

Estes testes não homologam entrega real dos provedores, login de uma sessão humana ou um evento operacional completo. A ponte com o Bot e a leitura dos logs de e-mail continuam dependentes da configuração e homologação próprias. Não foram alterados callbacks, credenciais de canais, resultados históricos ou ciência de tarefas da equipe.

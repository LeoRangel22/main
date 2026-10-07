# Pacote de prioridade máxima

Este pacote une integridade, implantação reproduzível e recuperação. A referência
de produção é o projeto Supabase de Eventos `pdgbnpztdnrvrphzdjas`.

## Comportamento

- Formulário: captura e conclusão usam exclusivamente RPCs, com identidade de
  captura existente, limites de tamanho e preservação do estágio comercial.
- Painel: toda gravação de proposta exige a revisão lida pelo editor. A atualização
  periódica não troca a revisão da edição em andamento. Conflitos retornam HTTP
  409 sem aplicar alterações; o usuário deve carregar novamente a proposta.
- Versões: numeração e promoção usam bloqueio por oportunidade; a combinação
  oportunidade/versão é única. Criação de outra versão exige origem e revisão.
- Cliente: a resposta inclui proposta, revisão e UUID de tentativa. Repetição do
  mesmo conteúdo devolve o resultado gravado; outro conteúdo não reutiliza o UUID.
  Não há confirmação automática de pagamento ou reserva.
- Links: renovação exige autenticação e o e-mail proprietário; links expirados
  recebem outro token. Revogação da equipe não pode ser desfeita pelo cliente.
- Exclusão: apenas super administrador. Trabalhadores internos mantêm sua API.
- Publicação: somente `dist/`, gerado por lista explícita de arquivos públicos.
  SDK Supabase e Playwright têm versões fixas e lockfile; ações usam SHA de commit.

## Banco e histórico

Os nomes dos treze arquivos históricos em `supabase/migrations/` foram alinhados
com as versões registradas em produção. Seus conteúdos foram preservados. O
antigo `finalize_event_system.sql`, sem entrada correspondente no ledger, pertence
ao bootstrap, não à sequência incremental de produção.

`supabase/bootstrap/manifest.json` define a ordem de uma instalação vazia. Esses
arquivos iniciais nunca devem ser reaplicados à produção. A função de notificação
do bootstrap lê duas configurações de Vault e fica inativa sem elas; não replica
segredos da instalação existente. A migração incremental não modifica callbacks,
credenciais ou ativação dos canais de Eventos ou do Bot.

Se uma ferramenta atribuir o timestamp ao aplicar uma migração, alinhar o nome
local ao timestamp efetivamente registrado antes de fechar a entrega. Não criar
uma segunda entrada para tentar corrigir um nome.

## Verificação

`npm ci && npm test` valida build, handlers e fluxos Chromium. O servidor de testes
serve o mesmo pacote público usado no deploy. `npm run test:db` exige PostgreSQL
descartável e local; cria `events_test` e `events_fresh_test`, recusando hosts
remotos. Não executar contra banco com esses nomes já em uso.

O job `database` em CI valida instalação vazia, atualização com histórico e
token preservados, permissões reais de anon/authenticated, revisões, repetição de
resposta, concorrência em conexões separadas e rollback de compatibilidade.
Depois, `scripts/restore-test.sh` realiza pg_dump/pg_restore no mesmo PostgreSQL
17, verificando dados, RPC e permissões restauradas.

Adapters de CI fornecem apenas auth.uid/auth.jwt, auth.users, cron.schedule e um
HTTP que falha se chamado. A verificação criptográfica real de JWT, execução do
scheduler e entrega dos provedores continuam sendo integrações de Supabase.
O teste de recuperação usa fixtures e não demonstra restauração de um backup
gerenciado de produção, nem define um RPO/RTO de produção medido.

## Implantação e recuperação

1. Aprovar todos os testes da revisão. Capturar SHA, versão de migração, contagens
   de propostas/solicitações/oportunidades e estado dos canais antes da mudança.
2. Aplicar somente a nova migração incremental no projeto de Eventos. Verificar
   colunas, RPCs, grants, versões únicas e contagens. Não reaplicar bootstrap.
3. Publicar o frontend pelo merge após as verificações. `release.json` registra
   commit, versão de banco esperada, SDK e hashes dos arquivos públicos.
4. Conferir site, formulário, login, proposta e ausência de SQL/package.json nas
   URLs públicas. Registrar resultados na revisão.

Em falha de frontend, publicar o último SHA conhecido. Se a versão anterior
precisar de gravações diretas, aplicar explicitamente
`supabase/rollback/priority_integrity_compatibility.sql` em transação, após
inspeção. Esse rollback reabre as APIs legadas: é uma medida emergencial, reduz
as garantias de concorrência e deve ser revertido por nova migração corrigida.
Mantém coluna de revisão, índice de versões e recibos; não apaga dados comerciais.
Não restaurar backup antigo sobre produção para corrigir um problema de UI.

Antes de prometer disponibilidade AAA+, ainda é necessário medir recuperação
gerenciada em ambiente separado, definir RPO/RTO com o negócio, fechar pendências
operacionais históricas, validar integrações ativadas e reduzir a carga de leitura.

# Aprovação remota de propostas

## Uso
A equipe revisa os dados, salva a proposta e usa o botão de solicitar aprovação por WhatsApp ou e-mail. O canal escolhido é o canal de **envio ao cliente**. Os avisos ao gestor são enviados nos dois canais configurados, vinculados à mesma solicitação.

O gestor abre `aprovacoes.html?id=...`, entra com sua conta e revisa proposta, condições, desconto, destinatário e mensagem exata. `Aprovar e enviar ao cliente` registra a decisão e inicia o envio aprovado. `Solicitar ajustes` e `Rejeitar esta versão` exigem motivo e não enviam a proposta. A equipe acompanha os motivos na central `aprovacoes.html`.

Abertura de link, prévia e acesso à central nunca aprovam propostas. Aprovação comercial não confirma pagamento, reserva, aceite do cliente nem ciência operacional.

## Integridade e acesso
- A autorização é conferida no banco por identificador do gestor configurado e perfil de administrador; informar um endereço de e-mail não concede acesso.
- A aprovação fica ligada à revisão, proposta completa, mensagem, canal, destinatário e prévia gerada pelo servidor. Mudanças ou resposta nova do cliente impedem o despacho antigo.
- Solicitações vencem em até 48 horas, ou no horário do evento quando anterior. A equipe precisa salvar/revisar novamente após alterações ou vencimento.
- Repetir uma solicitação pronta sem editar preserva a revisão e sua identidade: avisos aceitos não são enviados novamente. Salvar alterações intencionalmente continua invalidando a solicitação anterior.
- A tabela de solicitações é somente leitura para a equipe. Somente o serviço autenticado prepara o conteúdo; somente o gestor decide por ação explícita.
- O bloqueio de envio direto é aplicado na RPC do servidor. As duas sobrecargas antigas de `begin_event_send` permanecem sem execução concedida à equipe ou ao público.
- Links públicos e respostas não expõem versões novas pendentes. Na ativação, os conteúdos comerciais já publicados são preservados numa referência privada; essa referência não autoriza futuras mudanças de preço ou condições.
- Após o envio do gestor, uma aba limpa da equipe pode reconciliar somente metadados observados de envio para compartilhar a versão liberada. Alterações concorrentes não são incorporadas silenciosamente.
- O registro de envios existente garante a tentativa única. Resultado incerto ou em andamento não autoriza repetição automática. Recusa definitiva permite `Repetir envio recusado`, com nova confirmação explícita do gestor e conferência da mesma revisão, condições e validade.
- Os avisos usam os destinatários da configuração privada, nunca endereços enviados pelo navegador. Aceitação do provedor não comprova entrega ou leitura.
- Repetição explícita de avisos só retoma pendentes ou falhas definitivas com limite de tentativas. Não repete avisos aceitos, em andamento ou incertos.
- A interface verifica a política no servidor. Uma desativação confirmada restaura o fluxo legado revisado; indisponibilidade da leitura mantém o envio bloqueado, sem presumir que a política foi desativada.

## Publicação
1. Aplicar as migrações com política inicialmente desativada.
2. Publicar `event-proposal-approval`, os dois emissores e o módulo compartilhado de registro de envio; manter JWT obrigatório.
3. Publicar interface e verificar commit/arquivos públicos, tela de login móvel e recusa de chamadas anônimas.
4. Em transação, preservar as versões já públicas e configurar o gestor existente e seus destinos privados antes de ativar a política.
5. Conferir RLS, privilégios, configuração, inexistência de envios de teste e proteção dos links anteriores.

Os destinatários reais não pertencem ao repositório público. O recurso reutiliza os secrets dos provedores já instalados e não modifica callbacks ou integrações de recebimento do Bot.

## Testes e limites
`npm test` cobre handlers, interface, autenticação, decisão explícita, duplicidades, alterações concorrentes e erros de provedor. `tests/remote-approval-production.spec.js` exercita os caminhos sem QA_MODE, com cliente autenticado simulado. `npm run test:db` inclui `checks/remote-approval.sql`, sempre em bancos locais descartáveis; `scripts/restore-test.sh` verifica restauração isolada. Os testes usam dados sintéticos e provedores simulados, não clientes reais.

`scripts/verify-public-release.cjs` verifica o commit e os arquivos reais publicados, login interno e móvel, ausência de decisões sem login e recusa de POST anônimo na função de aprovação. Essas verificações não alteram propostas nem disparam mensagens.

Uma suíte automatizada aprovada não comprova que o telefone/e-mail do gestor recebeu um aviso real. Essa evidência depende da primeira solicitação autenticada e da conferência dos resultados nos canais. A configuração e publicação não disparam retroativamente pedidos para todas as propostas existentes.


## Fechamento e alertas — 13/10/2026
O conteúdo determinístico da solicitação agora possui identidade separada da decisão. Pedidos vivos iguais são reaproveitados; expirados ou decisões terminais recebem um sucessor com revisão comercial preservada, nova validade e histórico de vínculo. Despachos aceitos/em andamento/incertos nunca são renovados para gerar repetição. Uma decisão anterior não aprova seu sucessor.

As páginas internas e públicas alteradas usam a identificação `20261015-approval-closure` para invalidar os arquivos antigos no cache. O envio de resposta rápida com aprovação desativada preserva texto e assunto selecionados.

`event-approval-monitor` usa uma credencial de tarefa privada, verificada por RPC exclusiva do serviço. Não depende do navegador ou deste chat. O agendamento de cinco minutos é instalado desativado e só é habilitado após a função e a publicação serem conferidas. Não altera aprovações, propostas, pagamentos, callbacks ou o registro de envio ao cliente.

Detecção: avisos pendentes/em andamento por dez minutos, avisos recusados/incertos, solicitações aguardando decisão por duas horas, solicitações expiradas e decisões aprovadas sem despacho confirmado. Os alertas são enviados ao gestor nos dois destinos privados das 08h30 às 21h de Brasília. Fora desse horário, a detecção continua e a fila é revalidada antes do envio. Cada solicitação/motivo/canal tem uma identidade única; alertas aceitos/em andamento/incertos não se repetem. Somente alertas definitivamente recusados são tentados novamente, no máximo três tentativas, com intervalo mínimo de uma hora. Os avisos originais de aprovação e os envios ao cliente não são repetidos pelo monitor.

O painel autenticado mostra a última execução e o histórico de alertas. Falha de leitura do monitor não impede revisar uma proposta. Aceitação do alerta pelo provedor não comprova sua entrega. O teste real de transporte (`probeId` UUID), restrito à credencial privada, usa somente os destinos configurados do gestor, não cria proposta e não registra aprovação. Repetir o mesmo identificador não envia novamente; outro teste é limitado a um por hora. A primeira decisão real do gestor continua sendo uma validação separada.


## Revisão da PR #50 — 15/10/2026 (ainda sem implantação)
A branch incorpora `main` após #51/#52. O código de respostas rápidas da #51 e a integridade comercial/operacional da #52 são preservados; o emissor de e-mail e `app.js` não recebem uma implementação paralela.

- A consulta de saúde começa em paralelo e expira em três segundos. Falhas não bloqueiam lista, revisão ou decisão; respostas atrasadas não restauram dados após saída.
- `supabase/config.toml` contém `event-approval-monitor.verify_jwt=false`. Isso permite alcançar a autenticação customizada, não dispensa autenticação: a RPC exclusiva do serviço valida a chave privada antes de ler/obter trabalho. As funções do usuário continuam exigindo JWT.
- Detecção e revalidação usam o mesmo predicado privado para estado de transporte **e** recibo de entrega. `accepted` com `delivery_status=failed/uncertain` exige conferência; uma entrega recuperada não é reivindicada para alerta antigo.
- Tentativas `sending` abandonadas há dez minutos são marcadas `uncertain`, com identidade, execução e contagem preservadas; não voltam à fila. Conclusão consulta tentativas de todas as execuções, recusa saúde positiva com `sending/uncertain` e recusa conclusão de execução já substituída. A interface também exibe pendências definitivas, mesmo com verificação recente. Reconciliação com o provedor continua sendo operação humana explícita, não um reenvio automático.
- Identidade usa fingerprint comercial estável, condições de pagamento e conteúdo exato preparado. Exclui somente metadados de despacho e o hash de e-mail derivado da revisão; HTML/texto/destino/assunto/remetente continuam vinculantes. A migração recalcula identidades históricas a partir do snapshot aprovado e mantém `review_hash`/links intactos. Alterações comerciais ou de mensagem ainda criam revisão separada.

`checks/approval-closure-regressions.sql` testa despacho real **sintético** seguido de nova solicitação, alteração comercial/mensagem, recibos definitivos, predicado de revalidação e abandono de execução. O runner cobre instalação cronológica e instalação tardia sobre a estrutura da #52 com aprovação anterior à migração.

### Procedimento autorizado e dependências
O bloqueio de 13/10 foi registrado como “não foi possível determinar o status de segurança”. Ele não comprova defeito SQL, mas também não concede permissão para trocar de ferramenta ou executar o DDL por outro canal. Esta revisão não tenta novamente a instalação, não publica funções dependentes e não executa o transporte real, inclusive `probeId`.

1. Revisar o artefato imutável de `20261013183019_approval_closure.sql`, seu SHA-256 e as evidências de CI do commit final. A instalação tardia é necessária porque `journey_integrity` já existe em produção; não reaplicar migrações existentes nem reescrever seu histórico.
2. Obter autorização explícita para instalar **esta versão corrigida**, inicialmente desativada, usando `Supabase.apply_migration`, a operação DDL própria do conector. Submeter à avaliação normal da ferramenta. Se houver nova rejeição, interromper e registrar o motivo; não usar `execute_sql`, CLI, SQL Editor, outra credencial ou workflow como rota alternativa.
3. Após aprovação e instalação: conferir migração, funções, privilégios, RLS, `enabled=false`, ausência de alteração de propostas/envios/solicitações e cron sem execução de transporte. Não ler/expor a chave privada no relatório. A credencial é criada no banco; nenhuma cópia de secret no navegador é necessária.
4. Só depois dessas verificações, autorizar/publicar a função monitor com `verify_jwt=false`, módulo compartilhado de notificações e a função de aprovação que o importa; preservar a autenticação das funções existentes. Verificar rejeição sem chave e com chave inválida, sem trabalho ou mensagens. Publicar a interface somente após essas dependências e verificações. A integração em `main` aciona publicação automática do Pages, por isso manter esta PR como rascunho até então.
5. A ativação (`enabled=true` e URL privada do projeto) requer autorização específica: ela pode enviar alertas a destinatários reais já configurados. Homologar recebimento/decisão real é etapa separada, também autorizada; `probeId` envia mensagens reais e fica proibido nesta rodada. Aceitação pelo provedor não é prova de entrega.

Requisitos de banco: `pgcrypto`, `pg_net`, `pg_cron`; tabelas e política de aprovação anteriores; fingerprint comercial; permissões do serviço e destinatários privados existentes. A agenda instalada a cada cinco minutos é inerte enquanto a configuração está desativada. A instalação não ativa automaticamente o monitor.

Referência oficial de autenticação: https://supabase.com/docs/guides/functions/function-configuration

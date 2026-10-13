# Aprovação remota de propostas

## Uso
A equipe revisa os dados, salva a proposta e usa o botão de solicitar aprovação por WhatsApp ou e-mail. O canal escolhido é o canal de **envio ao cliente**. Os avisos ao gestor são enviados nos dois canais configurados, vinculados à mesma solicitação.

O gestor abre `aprovacoes.html?id=...`, entra com sua conta e revisa proposta, condições, desconto, destinatário e mensagem exata. `Aprovar e enviar ao cliente` registra a decisão e inicia o envio aprovado. `Solicitar ajustes` e `Rejeitar esta versão` exigem motivo e não enviam a proposta. A equipe acompanha os motivos na central `aprovacoes.html`.

Abertura de link, prévia e acesso à central nunca aprovam propostas. Aprovação comercial não confirma pagamento, reserva, aceite do cliente nem ciência operacional.

## Integridade e acesso
- A autorização é conferida no banco por identificador do gestor configurado e perfil de administrador; informar um endereço de e-mail não concede acesso.
- A aprovação fica ligada à revisão, proposta completa, mensagem, canal, destinatário e prévia gerada pelo servidor. Mudanças ou resposta nova do cliente impedem o despacho antigo.
- Solicitações vencem em até 48 horas, ou no horário do evento quando anterior. A equipe precisa salvar/revisar novamente após alterações ou vencimento.
- A tabela de solicitações é somente leitura para a equipe. Somente o serviço autenticado prepara o conteúdo; somente o gestor decide por ação explícita.
- O bloqueio de envio direto é aplicado na RPC do servidor. As duas sobrecargas antigas de `begin_event_send` permanecem sem execução concedida à equipe ou ao público.
- Links públicos e respostas não expõem versões novas pendentes. Na ativação, os conteúdos comerciais já publicados são preservados numa referência privada; essa referência não autoriza futuras mudanças de preço ou condições.
- O registro de envios existente garante a tentativa única. Resultado incerto não autoriza repetição automática.
- Os avisos usam os destinatários da configuração privada, nunca endereços enviados pelo navegador. Aceitação do provedor não comprova entrega ou leitura.
- Repetição explícita de avisos só retoma pendentes ou falhas definitivas com limite de tentativas. Não repete avisos aceitos, em andamento ou incertos.

## Publicação
1. Aplicar a migração com política inicialmente desativada.
2. Publicar `event-proposal-approval`, os dois emissores e o módulo compartilhado de registro de envio; manter JWT obrigatório.
3. Publicar interface e verificar commit/arquivos públicos.
4. Em transação, preservar as versões já públicas e configurar o gestor existente e seus destinos privados antes de ativar a política.
5. Conferir RLS, privilégios, configuração, inexistência de envios de teste e proteção dos links anteriores.

Os destinatários reais não pertencem ao repositório público. O recurso reutiliza os secrets dos provedores já instalados e não modifica callbacks ou integrações de recebimento do Bot.

## Testes
`npm test` cobre handlers, interface, autenticação, decisão explícita, duplicidades, alterações concorrentes e erros de provedor. `npm run test:db` inclui `checks/remote-approval.sql`, sempre em bancos locais descartáveis; `scripts/restore-test.sh` verifica restauração isolada. Os testes usam dados sintéticos e provedores simulados, não clientes reais.

Uma suíte automatizada aprovada não comprova que o telefone/e-mail do gestor recebeu um aviso real. Essa evidência depende da primeira solicitação autenticada e da conferência dos resultados nos canais.

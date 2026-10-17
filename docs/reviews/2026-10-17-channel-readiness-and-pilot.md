# Canais e piloto por evidências — 17/10/2026

## O que foi comprovado nesta rodada

Diagnósticos internos autenticados, sem envio de mensagens ou alteração de callbacks:

- A ponte em Eventos respondeu HTTP 409: URL e chave exclusiva ausentes no ambiente.
- O diagnóstico de e-mail respondeu HTTP 200: OAuth de leitura ausente; a instância WhatsApp configurada em Eventos retornou desconectada e informou callbacks existentes fora do receptor de Eventos.
- A leitura de configuração confirmou os três receptores desativados, cursor da ponte zero e nenhuma primeira sincronização bem-sucedida.

Esses dados não provam que o Bot usa a mesma instância configurada em Eventos. É preciso verificar a conta correta antes de qualquer reconexão. Nenhum callback foi substituído.

## Entrega técnica

- Diagnóstico das integrações na Central → Canais. A equipe pode solicitar uma consulta limitada aos dois workers de diagnóstico já existentes. Chaves ficam no servidor; somente campos booleanos previamente definidos chegam à interface.
- A consulta é compartilhada e limitada a uma execução por minuto. Leitura de status não cria chamadas externas. Expiração, falha, ausência de resposta e leitura antiga ficam explícitas.
- Central → Jornada e piloto mostra dez evidências da revisão escolhida: proposta, gestor, envio aceito, entrega, resposta, aceite, sinal, reserva, setores e desfecho. É uma leitura: não aprova, envia, valida pagamentos, reserva ou conclui tarefas.
- Aceitação do provedor não confirma entrega. Contato manual não comprova recebimento integrado. Pagamento legado não equivale a validação auditada neste fluxo. Checklist de outra versão não libera a versão atual. Data passada não comprova realização.
- O worker de entrega de e-mail não altera prontidão ao receber entrada inválida, erro de autenticação/configuração ou falha inesperada. Um erro transitório preserva a configuração existente para nova tentativa do agendador, sem habilitar uma configuração desativada.

## Reserva explícita de acordo legado

A validação de um sinal legado preserva a etapa e não cria automaticamente uma reserva. A trilha agora oferece ao gestor a conferência e confirmação explícita da reserva para um acordo atual, já confirmado e com início futuro. O servidor exige sinal auditado, revisa capacidade/conflitos e alçada, usa a revisão esperada e registra uma nota interna com o usuário real. Repetição não duplica a reserva ou a nota. Não há backfill automático.

O Financeiro ou gestor também pode conferir um sinal legado sem validação auditada a partir da trilha. A conferência exige extrato, valor, data e banco; mantém a etapa e preserva o comprovante.

## Para concluir a homologação real

1. Configurar por canais seguros a URL oficial do Bot e um segredo exclusivo. No Bot, usar `EVENTS_BRIDGE_SECRET` e `EVENTS_BRIDGE_ENABLED`; em Eventos, `EVENT_BOT_BRIDGE_URL` e `EVENT_BOT_BRIDGE_SECRET`. Não reutilizar chave de envio/webhook nem copiar segredos para Git, chat ou navegador.
2. Confirmar a conta/instância correta e a conexão. Usar a ponte de leitura preservando os callbacks que pertencem ao Bot; não criar outra instância.
3. Conceder e configurar a autorização de leitura de registros do ZeptoMail. O token de envio existente não concede essa leitura. Conectar a caixa de entrada é uma etapa distinta dos retornos de entrega.
4. Após o probe autenticado, usar a ativação verificada já existente. Só então acompanhar um retorno real, vinculado ao evento correto, e a confirmação de entrega do provedor. Nenhum reenvio é necessário para testar a leitura.
5. Escolher um evento futuro real para o piloto. Gestor decide; Financeiro confere o crédito; cada setor registra sua ciência e execução; o desfecho só é registrado quando conhecido pela equipe. A trilha mostra as evidências e as lacunas.

A publicação desta entrega não encerra esses passos nem declara os canais homologados. Aditivos completos continuam como próxima lacuna de desenvolvimento após este pacote.

## Validação técnica

257 verificações Node passaram. O CI confirmou banco novo, atualização, permissões, concorrência e restauração de backup no PostgreSQL 17. A migração foi registrada no ambiente com a versão `20261017070555`; o nome no repositório acompanha esse registro. A função `event-email-delivery` foi publicada na versão 4, mantendo a autenticação por chave do agendador.

# E1: uma mensagem WhatsApp de teste, sem proposta comercial

Estado: candidato local, não publicado, sem mensagens enviadas. Base publicada: `8e8ebfba89597dd95db8184c0db2b85cdfa099ae`. Este documento não autoriza execução.

## Alterações que precisam de aprovação específica

1. Abrir PR em rascunho, validar CI do SHA exato e, após aprovação de publicação, integrar os arquivos deste candidato e publicar os dois recursos estáticos `piloto-whatsapp.html` e `piloto-whatsapp.js`.
2. No Supabase Eventos `pdgbnpztdnrvrphzdjas`, aplicar somente `20261026182628_single_whatsapp_pilot.sql` e publicar somente a Edge Function `event-whatsapp-pilot`, com verificação JWT ligada. A migração instala uma tabela privada vazia com RLS, sem acesso direto de anon/authenticated/service_role. Concede execução de `get_event_whatsapp_pilot(uuid)` e `claim_event_whatsapp_pilot(uuid)` a authenticated, exigindo Master, conta confirmada/não banida e proprietário exato do piloto. `finish_event_whatsapp_pilot(uuid,text,text,boolean)` é exclusiva de service_role. Não cria usuários ou amplia perfis.
3. Configurar exclusivamente o piloto abaixo nos dois destinos existentes; não criar, ler para exibição ou substituir os segredos existentes. Conceder no Bot o consentimento e o grant de envio para um único ID, destinatário, corpo, hash, tentativa e prazo. Isso é uma concessão de envio delimitada, que precisa constar da aprovação; a autorização anterior para criar os pares não a substitui.
4. Executar uma única mensagem sintética pela rota Eventos → Bot → WhatsApp ao próprio Leo, telefone completo obtido da política autenticada já conferida, final 0692. Sem email, proposta real, cobrança, reserva, clientes, monitor, lote ou repetição automática.

## Configuração exata

Destino Supabase: `pdgbnpztdnrvrphzdjas`.

| Nome | Valor/limite |
| --- | --- |
| EVENT_BOT_SEND_URL | https://script.google.com/macros/s/AKfycbzNGnL3nMHDHX_xLfg7g-XpvAheJsoiyflp7yMW8vSjp9z5iOAjqPZ0TX9w_XAjkDzE/exec |
| EVENT_BOT_SEND_MODE | pilot |
| EVENT_BOT_SEND_ENABLED | false durante toda a operação |
| EVENT_BOT_PILOT_ENABLED | false na preparação; true somente na janela aprovada; false no encerramento |
| EVENT_BOT_PILOT_ID | um UUID único, fixado no recibo de execução antes de qualquer envio |
| EVENT_BOT_PILOT_PHONE | telefone canônico de Leo, conferido privadamente na origem autenticada; não publicar no repositório |
| EVENT_BOT_PILOT_EXPIRES_AT | instante ISO UTC fixo, com janela máxima de 15 minutos |

`EVENT_BOT_SEND_SECRET` existente será usado internamente, sem exibição ou substituição. `EVENT_BOT_BRIDGE_SECRET` permanece intacto. Não configurar/ativar retorno, delivery sync ou canais comerciais nesta etapa. Os consumidores Edge antigos continuam bloqueados pela flag comercial false; não é necessário republicá-los para o piloto.

Destino GAS: script `15sRskkMF0PsbZhfUUkbYkvh-znscKoSNw1uIQAC22GCs8KQbTrScbnG0`, runtime principal/API 1562, 77 fontes preservadas. Confirmar novamente baseline e configurações por leitura segura antes de escrever. A preparação deverá usar os mecanismos existentes de consentimento e grant (`_eventsRecordConsent_`, `_eventsRegisterGrant_`), sem editar/publicar fontes ou criar endpoint. O grant `EVENTS_SEND_GRANT_V2` e o consentimento `WA_EVENTS_CONSENT_<hash interno>` devem limitar purpose `event_diagnostic`, contexto/ID iguais ao UUID aprovado, revisão 1, tentativa 1, destino, conteúdo/hash e expiração exatos. `EVENTS_SEND_ENABLED` somente na janela delimitada, sem alterar prioridades, orçamento, saúde, horários ou outros limites. Se os mecanismos existentes não comportarem esse escopo ou houver drift, parar antes da concessão e reportar; não adaptar produção por improviso.

Criar uma única linha privada de piloto apenas após aprovação: proprietário é a conta Auth existente de Leo, destino conferido, corpo gerado por `botPilotMessage(id)`, hash calculado por `botContentHash` com o mesmo contexto/expiração do Bot, referência da aprovação e janela de até 15 minutos. Não embutir telefone, UUID de usuário ou segredos no SQL versionado. Há índice de apenas um piloto habilitado, identidade imutável e limite de uma tentativa. Não reaproveitar outro ID nem reabilitar linha encerrada.

## Corpo fixo

```text
TESTE CONTROLADO — Eventos via Bot.
Leo, responda TESTE RECEBIDO a esta mensagem.
Este teste não é proposta comercial e não gera reserva, aprovação ou cobrança.
Referência de teste: <UUID único aprovado>
```

O corpo efetivo é o retorno literal de `botPilotMessage(id)`; nenhuma edição de texto é permitida na tela ou no endpoint.

## Ordem de execução e aceite

1. Confirmar SHA, CI, drift, controles atuais e reversão; instalar SQL/Edge/app ainda inativos. Não repetir migrações anteriores ou vínculo de Gerência.
2. Fixar ID, proprietário, destino, corpo/hash e expiração; configurar pins com ambas as flags de envio false. Registrar somente metadados não secretos.
3. Dentro da janela aprovada, provisionar a linha privada e o consentimento/grant exatos no Bot. Ativar apenas o gate escopado Bot e a flag PILOT_ENABLED por último. A política comercial, bridge, email e canais gerais continuam OFF.
4. Entrar com Leo, informar somente o UUID e executar a prévia somente leitura. Conferir final do número, corpo e prazo. A prévia nunca faz claim ou envio.
5. Confirmar uma vez na tela. O claim persistido precede o POST ao Bot. Repetição, clique duplo, recarga ou resultado incerto não autorizam novo envio. Se houver timeout, falha de persistência ou resposta ambígua, reconciliar registros existentes; não clicar novamente nem criar outro piloto.
6. Correlacionar UUID, única tentativa, status e ID do provedor. Obter confirmação de recebimento de Leo. `accepted` comprova aceitação, não entrega ou resposta integrada em Eventos. O retorno `event_diagnostic` ainda não é compatível com a ponte publicada; E2 e igualdade do par de retorno permanecem não homologados.
7. Desligar PILOT_ENABLED e encerrar o grant/gate do piloto sem alterar configurações alheias; desabilitar a linha, preservando auditoria. Conferir controles OFF e ausência de segunda tentativa. A janela expirada bloqueia o transporte mesmo que a limpeza operacional atrase.

## Riscos e reversão

Uma mensagem já entregue ao transporte não pode ser cancelada por rollback. A instalação inclui novas RPCs autenticadas, protegidas também no banco por propriedade e Master; por isso exige revisão e CI do commit exato. Não tratar testes locais como homologação de produção ou como prova de igualdade dos segredos.

Reversão preparada em `single-whatsapp-pilot-rollback.sql`: desligar PILOT_ENABLED primeiro, manter SEND_ENABLED false, coordenar pelo mesmo advisory lock, desabilitar linhas e revogar get/claim. Preservar finish exclusivo de service_role para reconciliar operação em voo, linhas e histórico. Não apagar registros, resetar tentativas ou restaurar runtime GAS antigo. Restaurar somente configuração introduzida para este piloto, após conferir drift.

Estimativa operacional após aprovação e acessos disponíveis: publicação/CI e conferência dependem da fila remota; reservar aproximadamente 15–30 minutos, seguidos de janela de piloto de até 15 minutos. Resposta humana e falhas externas não estão incluídas. Nenhuma ativação deve começar antes de publicação e pré-verificações concluídas.

## Evidência local e limites

687 testes lógicos aprovados; nove cenários de navegador aprovados, com chamadas sintéticas e sem perfil Chrome do usuário. PostgreSQL nativo 17.10 aprovou atualização, ACL/RLS, isolamento, idempotência, concorrência e reversão nos dois sentidos; cluster sintético encerrado. O build estático foi validado. Manifesto e patch finais são artefatos externos de verificação, vinculados à base acima.

Revisão independente manual em duas rodadas. A ferramenta automatizada Codex Security não pôde ser executada: referências obrigatórias de preflight indisponíveis e nenhuma ferramenta de scan exposta. Isso não equivale a uma auditoria automatizada aprovada. CI remoto, versão produtiva deste candidato, envio, entrega e retorno ainda não executados.

# Analytics do Sistema de Eventos

O PostHog mede o caminho do primeiro acesso ao formulário até a passagem do evento para operações. A instrumentação usa eventos explícitos em `analytics.js`; não carrega o SDK de autocaptura.

## Privacidade

- Nenhum nome, e-mail, telefone, mensagem, comprovante, URL ou token é enviado.
- IDs de oportunidade e proposta são transformados em SHA-256 truncado antes do envio.
- Valores, convidados, duração e antecedência são enviados somente em faixas.
- Autocaptura, replay de sessão, console, performance e Web Vitals estão desativados no projeto.
- O IP é anonimizado e `$process_person_profile` permanece desativado.
- A coleta respeita `Do Not Track` e o opt-out local `EventAnalytics.setOptOut(true)`.
- A coleta fica desligada em localhost e hosts não aprovados.

## Jornadas medidas

| Jornada | Eventos principais | Pergunta respondida |
| --- | --- | --- |
| Captação | `lead_form_viewed`, `lead_form_started`, `lead_form_abandoned`, `lead_created` | Onde o cliente abandona antes de enviar a solicitação? |
| Recompra | `returning_event_reused` | Quantos clientes reaproveitam um evento anterior? |
| Proposta | `proposal_generated`, `proposal_sent`, `proposal_viewed`, `proposal_response_started`, `client_replied` | A proposta chega ao cliente e gera resposta autônoma? |
| Upselling | `proposal_upsell_selected`, `proposal_upsell_requested` | Quais propostas despertam e convertem interesse em adicionais? |
| Pagamento | `payment_instructions_used`, `signal_proof_submitted` | O cliente consegue avançar no sinal sem intervenção? |
| Ajuda | `client_help_requested`, `client_contact_recorded`, `team_action_planned` | Onde ainda é necessária atuação humana? |
| Fechamento | `reservation_held`, `event_won`, `event_lost`, `event_archived` | Qual é o desfecho comercial da oportunidade? |
| Operação | `operational_handoff_started`, `operational_checklist_completed` | O evento fechado chega completo à equipe operacional? |

`client_help_requested` registra apenas a abertura do canal de ajuda. `client_contact_recorded` exige que a equipe registre um contato realmente realizado; os dois sinais não devem ser confundidos.

## Leitura do painel

O painel **Sistema de Eventos — Conversão, Upselling e Automação** usa:

- microfunis por `$session_id` para etapas que acontecem na mesma visita;
- `count(distinct properties.entity_hash)` para marcos que atravessam sessões e áreas do sistema;
- janela móvel de 90 dias e agregação semanal para tendências.

Não há tentativa de construir um funil nativo entre sessões diferentes. O `distinct_id` é deliberadamente efêmero; a correlação longitudinal ocorre apenas pelo hash da entidade, sem criar perfil de pessoa.

## Liberação e operação

1. Publicar a aplicação e confirmar no PostHog o primeiro evento de cada superfície: formulário público, proposta pública e painel interno.
2. Conferir que as propriedades recebidas respeitam a allowlist e não contêm PII.
3. Marcar uma definição como verificada somente depois dessa observação em produção.
4. Aguardar uma linha de base real antes de criar alertas. Uma janela inicial de duas semanas evita limites arbitrários.
5. Revisar semanalmente abandono, pedidos de ajuda, upselling, eventos fechados sem passagem operacional e checklists pendentes.

O token usado no navegador é o project token público e de escrita. Chaves pessoais e credenciais administrativas do PostHog nunca devem entrar no frontend.

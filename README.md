# Sistema de Eventos

CRM comercial e operacional da Embaixada Carioca para captar leads, montar e versionar propostas, registrar decisões e pagamentos, planejar o evento e acompanhar o pós-venda.

## Estado atual — 05/10/2026

- O painel abre em **Modo Vendas** e mantém financeiro, operação, agenda e relatórios na **Visão completa**.
- Eventos passados saem do funil ativo e aguardam classificação humana; remarcações retornam ao acompanhamento.
- O rascunho inteligente sugere pacote, adicionais, duração e mensagem, mas só é aplicado após aprovação humana.
- Propostas preservam V1/V2/V3, podem ser duplicadas, comparadas e mostram ao cliente o que mudou.
- Desconto acima de R$ 1.000 ou 10% do subtotal exige confirmação e e-mail do gestor antes do envio.
- Relatórios medem primeira resposta desde a entrada da oportunidade. A previsão ponderada inclui somente vendas em aberto futuras ou sem data; realizados, perdidos e eventos passados não inflam o valor. Motivos de perda usam apenas encerramentos de perda/cancelamento. Recompra e produtos vendidos preservam o histórico.
- Respostas na versão publicada têm prioridade sobre rascunhos ainda em preparo; o card mantém acesso à nova versão.
- Retornos futuros respeitam o prazo no card, no SLA e no radar; conflitos de agenda não são silenciados.
- Atualizações da proposta preservam o responsável escolhido no plano comercial. Oportunidades encerradas deixam de gerar prazos comerciais.

## Checklist de produção

A instalação vazia segue `supabase/bootstrap/manifest.json`, depois os arquivos em
`supabase/migrations/` em ordem. Produção recebe somente migrações ainda não
registradas; nunca reaplique `schema.sql` ou o bootstrap à base existente.

O pacote de prioridade máxima e os procedimentos de validação e recuperação estão
em [docs/PRIORITY-RELEASE.md](docs/PRIORITY-RELEASE.md). `npm run build` cria o pacote
público `dist/`. O deploy depende dos testes de interface e dos testes PostgreSQL,
incluindo concorrência, atualização com histórico e pg_dump/pg_restore.


Depois do SQL e do deploy:

1. Publique preços/regras e modelos de comunicação com um vendedor autenticado.
2. Confira os dados compartilhados em um segundo navegador.
3. Teste login real no endereço raiz do Sistema de Eventos. `/painel/` incorpora o **Bot**, que tem autenticação e validação próprias.
4. Rode os dry-runs autenticados de e-mail e WhatsApp com destinatário controlado.
5. Reprocesse e confirme a entrega do lead que estiver em `FALHA`.

Nunca use `service_role` no frontend e nunca trate comprovante como confirmação automática de pagamento ou reserva.

## Como abrir

Abra `index.html` no navegador.

## Supabase: login e histórico da equipe

1. Crie um projeto no Supabase.
2. Abra `supabase/schema.sql`, copie o conteúdo e rode no SQL Editor do Supabase.
3. Em `Authentication > Providers`, mantenha o login por e-mail habilitado.
4. Em `Authentication > URL Configuration`, use `https://leorangel22.github.io/main/` como `Site URL`.
5. Em `Redirect URLs`, deixe `https://leorangel22.github.io/main/` e `https://leorangel22.github.io/main/**`.
6. No app, a conexão técnica já vem preenchida. A equipe só precisa entrar com o e-mail autorizado.

O histórico fica compartilhado somente entre os e-mails liberados no schema:

- `leorangel@gmail.com`
- `eventos@embaixadacarioca.com.br`

Para alterar o acesso da equipe, prepare uma migração específica da autorização. Nunca reaplique `schema.sql` sobre a base existente.

## Formulário público para clientes

O formulário externo fica em:

`https://leorangel22.github.io/main/formulario.html`

Fluxo recomendado:

1. Envie o link do formulário ao cliente.
2. O cliente preenche contato, tipo de evento, data, horário, convidados, duração e observações.
3. A solicitação entra na tabela `solicitacoes_cotacao` do Supabase.
4. No app interno, entre com o e-mail da equipe e clique em `Atualizar` em `Solicitações recebidas`.
5. Clique em `Usar na proposta` para preencher os dados do cliente automaticamente.
6. Revise, ajuste itens/preços e gere a proposta em PDF, e-mail ou WhatsApp.

Em produção, as tabelas e RPCs já estão instaladas. Clientes usam as RPCs de captura parcial e conclusão; não conseguem ler o histórico da equipe. Instalações novas seguem o schema inicial e depois as migrações, nessa ordem.

Projeto configurado no app:

- URL: `https://pdgbnpztdnrvrphzdjas.supabase.co`
- Chave usada: `anon public key`, própria para uso no navegador. Não coloque `service_role` no app.

## Fluxo de montagem

1. Preencha nome, e-mail, quantidade de convidados, duração e observações.
2. Em `Configuração do evento`, escolha o tipo de evento.
3. Para `Coquetel`, escolha uma bebida e depois uma comida. A opção `Nenhum` remove o pacote de comidas.
4. Para `Workshop de Caipirinha`, `Café da Manhã / Coffee Break` e `Welcome Drink`, o app filtra os itens correspondentes para você escolher.
5. Ajuste itens, quantidades e preços se necessário.
6. Em `Cálculo e privatização`, informe o motivo do evento e revise subtotal, taxa de serviço e regra de exclusividade.
7. Revise `Condições gerais`, principalmente a validade do tarifário.
8. Envie por e-mail, copie a proposta, abra o WhatsApp ou gere PDF pela impressão do navegador.

## Privatização

A seção `Cálculo e privatização` aplica a regra antes da proposta final:

- `Subtotal`: soma dos itens selecionados.
- `Taxa de serviço`: 12% sobre o subtotal.
- `Pico obrigatório`: quando o evento cruza o horário de pico do dia selecionado, aplica privatização parcial até 40 pessoas ou total acima de 40 pessoas.
- `Fora do pico`: usa o valor `Fora pico` do dia selecionado e pergunta se a exclusividade deve entrar na proposta.
- `Sem regra`: quando não há dia/horário de pico ou valor opcional configurado, segue sem privatização.

Use `Tabela de privatização por dia` para ajustar abertura, início/fim de pico, fechamento e valores de segunda a domingo.

## Criar novos itens

Use a área `Criar novo item`, dentro de `Preços ajustáveis`.

- `Código`: opcional. Se ficar vazio, o app cria um código automático.
- `Tipo`: categoria usada no filtro, como Coquetel, Comidas, Snacks ou Welcome Drink.
- `Nome`: nome comercial do pacote.
- `Fórmula`: define como o item será calculado.
- `Descrição`: texto que aparece na proposta.
- `Preços`: podem ser por hora, fixos, adicionais ou mínimo de pessoas.

Ao clicar em `Adicionar item`, o novo pacote entra na lista de preços e já fica selecionado no orçamento atual. As alterações ficam salvas neste navegador.

## Condições gerais

A seção `Condições gerais` entra no PDF, no e-mail e no texto copiado para WhatsApp. O texto fica salvo neste navegador e pode ser editado antes do envio.

Atenção: confira a linha de validade do tarifário antes de cada temporada comercial. O padrão atual informa validade até `31/12/2026`.

## Assets de marca

- A logo oficial convertida fica em `assets/logo-embaixada.svg`.
- A logo de redução para usos pequenos fica em `assets/logo-reducao.svg`.
- O PDF original da logo fica em `assets/LOGO_EMBAIXADA_CARIOCA_PRINCIPAL_COR.pdf`.
- O PDF original da logo de redução fica em `assets/LOGO_EMBAIXADA_CARIOCA_REDUCAO_MAX_15mm.pdf`.
- A foto do restaurante fica em `assets/venue.jpg`. Se esse arquivo não existir, o app usa uma imagem externa temporária.

## O que já faz

- Edita preços no próprio app.
- Salva os preços ajustados no navegador.
- Cria novos itens de orçamento sem editar código.
- Conecta ao Supabase para login por e-mail.
- Salva propostas no histórico da equipe.
- Reabre propostas salvas para copiar, enviar ou gerar PDF novamente.
- Recebe solicitações por formulário público.
- Importa dados do formulário para revisar e montar a cotação.
- Calcula orçamento por convidados, duração e mínimo de pessoas.
- Soma taxa de serviço de 12% e privatização quando aplicável.
- Inclui condições gerais editáveis na proposta final.
- Gera a proposta pronta na tela.
- Abre e-mail com assunto e corpo preenchidos.
- Copia a proposta em texto para enviar no WhatsApp.
- Abre WhatsApp Web com a proposta preenchida.
- Usa impressão do navegador para salvar a proposta em PDF A4 otimizado para até 2 páginas.

## Fórmulas disponíveis

- `Por pessoa + duração`: usa preço de 1h, 2h e acréscimos de 1/2h extra.
- `Por pessoa fixo`: multiplica o preço fixo pela quantidade faturada.
- `Fixo + por pessoa`: soma um valor fixo ao preço por pessoa.
- `Fixo inclui mínimo`: usa o preço fixo até o mínimo de pessoas e cobra adicional por pessoa extra.
- `Valor fixo total`: cobra apenas o preço fixo.

## Integrações operacionais

- `notify-new-lead`: recebe entradas novas do bot e do formulário, com deduplicação e proteção contra loops.
- `send-proposal-email`: envia o resumo e link público; valide primeiro em dry-run autenticado.
- Link público: permite aprovar, pedir ajuste, cancelar, tirar dúvida e anexar comprovante sem confirmar a reserva automaticamente.
- Configurações compartilhadas: preços, regras e modelos usam Supabase como fonte comum depois da primeira publicação autenticada.

Propostas e PDFs antigos são imutáveis. Para refletir uma correção, duplique a versão, ajuste e publique uma nova.

## Central comercial P0/P1

O Sistema de Eventos opera de forma independente. A futura integração deve consultar informações do Bot; não há sincronização automática neste pacote.

A central reúne pendências, conversas registradas, envios e reservas. Planejamento em lote não registra contato. Respostas externas podem ser registradas manualmente; recebimento automático e callbacks de entrega dependem de configuração futura. Copiar um rascunho também não registra envio.

O gestor configura a capacidade simultânea autorizada em Central comercial → Reservas. Nenhum valor foi presumido. O responsável padrão vale para novas oportunidades; os registros antigos continuam sujeitos à triagem. Confirmações futuras exigem capacidade, disponibilidade e valor do sinal registrado. Pré-reservas têm validade máxima de 30 dias.

Descontos acima de R$ 1.000 ou 10% do subtotal exigem aprovação do gestor autenticado da versão salva. Informar um e-mail na proposta não concede alçada. Alterações comerciais invalidam a aprovação.

Envios exigem revisão humana e são deduplicados no servidor. Aceitação pelo provedor não comprova entrega. Timeout, HTTP 5xx ou resultado incerto não autorizam reenvio automático. Conferir o canal antes de qualquer nova tentativa. A homologação real exige login da equipe e destinatário de teste definido, sem envio para clientes durante os testes.

As alternativas usam itens do catálogo e o mesmo cálculo de preços/taxas da proposta. Escolher uma alternativa solicita ajuste e nova versão, sem aprovar automaticamente outro preço.

Validação: `npm test` executa testes locais dos handlers e os fluxos Playwright. As migrações e Edge Functions devem estar publicadas antes da interface.

## Analytics de produto

O funil comercial, o upselling, a autonomia do cliente e a passagem operacional são medidos no PostHog com eventos explícitos e sem PII. A taxonomia, as garantias de privacidade e o procedimento de validação em produção estão em [`docs/event-analytics.md`](docs/event-analytics.md).

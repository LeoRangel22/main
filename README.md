# Orçamentos de Eventos

Aplicativo estático para montar propostas da Embaixada Carioca com preços ajustáveis.

## Como abrir

Abra `index.html` no navegador.

## Supabase: login e histórico da equipe

1. Crie um projeto no Supabase.
2. Abra `supabase/schema.sql`, copie o conteúdo e rode no SQL Editor do Supabase.
3. Em `Authentication > Providers`, mantenha o login por e-mail habilitado.
4. Em `Authentication > URL Configuration`, coloque a URL onde o app ficará publicado como `Site URL`.
5. Copie `Project URL` e `anon public key` em `Project Settings > API`.
6. No app, preencha `Supabase URL` e `Supabase anon key`, clique em `Conectar Supabase` e entre com o e-mail da equipe.

O histórico fica compartilhado entre todos os usuários autenticados nesse projeto Supabase. Para limitar o acesso, use somente e-mails da equipe no Auth do Supabase.

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

Importante: rode novamente `supabase/schema.sql` no SQL Editor para criar a tabela `solicitacoes_cotacao` e liberar apenas `insert` anônimo para clientes. Clientes não conseguem ler o histórico.

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

Atenção: o texto padrão recebido informa validade até `30/06/2025`; atualize essa linha antes de enviar propostas atuais.

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

## Próxima integração

O código do bot em Google Apps Script pode ser conectado depois para:

- Ler os preços direto da aba `Cardapio` ou de uma nova aba `Orcamentos`.
- Receber pedidos de orçamento pelo WhatsApp.
- Salvar propostas geradas em uma aba de histórico.
- Enviar link de proposta ou PDF para a equipe.

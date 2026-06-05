# Plano multi-loja do Sistema de Eventos

Este documento organiza o caminho para o sistema atender Embaixada Carioca, Cantina do MAM, Academia da Cachaca e novas casas sem duplicar codigo.

## Principio central

O sistema deve ser um produto unico com configuracoes por loja. Assim, quando melhorarmos funil, checklist, proposta publica, WhatsApp, e-mail, relatorios ou UX, todas as lojas recebem a melhoria automaticamente.

## O que ja existe

- Funil comercial e operacional.
- Formulario publico.
- Proposta publica com decisao do cliente.
- Envio por WhatsApp via Z-API.
- Envio por e-mail via ZeptoMail.
- Cadastro/historico de clientes.
- Produtos, valores, privatizacao e textos de comunicacao editaveis.
- Perfis iniciais: master, eventos e financeiro.

## O que falta para multi-loja real

### 1. Loja como entidade principal

Cada lead, proposta, cliente, produto, regra de privatizacao e texto precisa pertencer a uma loja.

Campos minimos por loja:

- nome comercial;
- slug publico;
- logo;
- foto principal;
- cores;
- e-mail de eventos;
- WhatsApp de eventos;
- regras comerciais padrao;
- dados bancarios/pix;
- dominio ou URL publica.

### 2. Permissoes por loja

Uma pessoa pode trabalhar em uma ou varias lojas.

Papeis recomendados:

- `master`: ve todas as lojas e administra tudo;
- `admin`: administra lojas liberadas;
- `gerente`: ve comercial, financeiro e operacao da loja;
- `eventos`: atende leads, propostas e operacao;
- `financeiro`: ve pagamentos, comprovantes e relatorios financeiros.

### 3. Catalogo por loja

Produtos e precos devem sair do navegador/localStorage e ir para tabelas por loja.

Entidades recomendadas:

- tipos de produto;
- produtos;
- regras de privatizacao;
- condicoes comerciais;
- textos de comunicacao;
- modelo de proposta;
- checklist operacional;
- insumos.

### 4. Formulario publico por loja

URLs possiveis:

```text
/formulario.html?loja=embaixada-carioca
/formulario.html?loja=cantina-mam
/formulario.html?loja=academia-cachaca
```

O formulario deve carregar:

- identidade visual da loja;
- produtos recomendados;
- e-mail/telefone de contato;
- textos e politica comercial.

### 5. Proposta publica por loja

A proposta publica deve usar a identidade da loja dona da proposta:

- logo;
- foto;
- cores;
- dados bancarios;
- contato humano;
- textos de aceite, pagamento e cancelamento.

### 6. Comunicacao por loja

Templates de e-mail e WhatsApp devem ter:

- texto padrao global;
- texto customizado por loja;
- variaveis como `{{cliente}}`, `{{link_proposta}}`, `{{valor_total}}`, `{{prazo_sinal}}`.

### 7. Relatorios multi-loja

O master precisa ver:

- consolidado do grupo;
- por loja;
- por periodo;
- por origem;
- por perfil de cliente;
- conversao lead -> proposta -> sinal -> realizado.

## Fases recomendadas

### Fase 1 - Fundacao segura

Rodar `supabase/multistore_phase1.sql`.

Entrega:

- cria `stores`;
- cria `store_members`;
- adiciona `store_id` em propostas, solicitacoes e visualizacoes;
- deixa Embaixada como loja padrao;
- troca permissoes fixas por permissoes por loja;
- preserva o app atual.

Como aplicar sem risco:

1. Rodar o SQL em um horario calmo.
2. Conferir se as tabelas `stores` e `store_members` foram criadas.
3. Conferir se `propostas`, `solicitacoes_cotacao` e `proposta_visualizacoes` ganharam `store_id`.
4. Entrar no sistema com `leorangel@gmail.com`, `eventos@embaixadacarioca.com.br` e `financeiro@embaixadacarioca.com.br`.
5. Criar uma proposta de teste e enviar somente para um contato de teste.
6. So depois disso iniciar a Fase 2.

Importante: nesta fase o app continua abrindo a Embaixada Carioca como padrao. A migracao prepara o banco; ela ainda nao muda visualmente o uso diario.

### Fase 2 - Configuracoes no banco

Migrar para o Supabase:

- produtos;
- tipos de produto;
- privatizacao;
- comunicacao;
- condicoes comerciais;
- dados bancarios.
- regras de sinal e pagamento;
- ficha tecnica e checklist operacional;
- lista de insumos.

Enquanto isso, manter localStorage como fallback para nao parar a operacao.

### Fase 3 - Seletor de loja

No dashboard:

- mostrar seletor de loja para quem tem mais de uma;
- eventos/financeiro/gerente veem apenas as lojas liberadas;
- master ve todas.

### Fase 4 - Formulario e proposta por loja

Criar carregamento por `?loja=`.

Exemplo:

```text
https://leorangel22.github.io/main/formulario.html?loja=embaixada-carioca
https://leorangel22.github.io/main/formulario.html?loja=cantina-mam
```

### Fase 5 - Automacao e IA por loja

Depois que os dados estiverem bem estruturados:

- IA sugere formato;
- IA aponta riscos;
- IA recomenda upsell;
- humano aprova;
- sistema envia.

## Cuidados importantes

- Nao duplicar arquivos por loja.
- Nao criar uma versao do sistema para cada restaurante.
- Nao colocar token privado no navegador.
- Nao misturar dados financeiros de lojas diferentes.
- Nao permitir que equipe de uma loja veja proposta de outra sem permissao.

## Estado ideal

Uma unica plataforma:

- master escolhe a loja ou ve consolidado;
- equipe de eventos atende as lojas liberadas;
- financeiro acompanha pagamentos das lojas liberadas;
- cada loja tem sua marca, produtos, precos e textos;
- toda melhoria de UX entra para todas automaticamente.

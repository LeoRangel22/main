# Revisão e implantação integrada — 18/10/2026

Continuação autorizada: revisar o piloto comercial, o ciclo de aditivos e os canais, corrigir pendências e verificar a publicação. Preservam-se as decisões de autonomia da equipe da PR #57: a aprovação geral obrigatória permanece desativada. Isso não remove a revisão própria de aditivos, as exceções financeiras ou os controles de execução.

## Implementação desta revisão

PR #59 fecha a auditoria canônica dos pagamentos usados em reserva/aditivo, evita orientação de novo pagamento quando sinal ou saldo ainda estão em conferência, preserva autoria/data em confirmações repetidas, vincula custos à composição revisada e protege edições concorrentes. A preparação comercial passa a usar evidência temporal em vez da criação do rascunho. Ficha, checklist e resumo passam a identificar a pessoa responsável, sem substituir pessoa por setor.

A revisão de publicação detectou que os arquivos alterados poderiam manter o mesmo identificador de cache. O build agora conserva o identificador legível e acrescenta uma assinatura dos bytes a todos os scripts/estilos locais já versionados. Conteúdo novo gera URL nova automaticamente; referências externas e SDK não versionado permanecem intactos. O manifesto é calculado depois da transformação do HTML. Quatro regressões conferem alteração, estabilidade e correspondência exata dos arquivos publicados.

## Instalação do banco

As três migrações foram instaladas pelo conector normal e lidas de volta. Os arquivos foram renomeados, sem alteração dos bytes, para os identificadores registrados pelo banco:

| Migração | Versão instalada | SHA Git do conteúdo instalado e versionado |
|---|---|---|
| payment_reservation_review | 20261018201030 | d3f629c2a21a7e1b8d358d36507ef0962728d003 |
| production_cost_review | 20261018201111 | 51c56b642ef929508c4f98b97296759b37c523a3 |
| cohort_preparation_review | 20261018201150 | 6f2e5697c1d65b23f508c7ab5bdccae6c01ce79d |

Leitura às 20:12:30 UTC confirmou hashes integrais de propostas, oportunidades, tarefas e outbox idênticos aos do início. A nova tabela privada de preparação contém 23 observações sustentadas por evidência existente, sem alterar acordos nem suas revisões. RLS ativo e acessos da equipe/anônimos às estruturas auxiliares privados revogados. Custos e planos existentes estavam vazios; nenhuma evidência financeira ou operacional foi criada.

## Homologação e dependências

Existem registros de uso real posteriores ao diagnóstico antigo: 23 solicitações de aprovação, 13 decisões registradas e 19 envios aceitos (17 WhatsApp e 2 e-mail). Esses registros não comprovam entrega ao destinatário nem uma homologação presencial de toda a jornada. O teste de aviso recebido por e-mail em 15/10 é evidência histórica, não um teste repetido nesta sessão.

Diagnóstico autenticado solicitado às 20:12:13 UTC, sem alteração de callbacks: URL e segredo exclusivo da ponte ausentes; OAuth de leitura de e-mail ausente; instância WhatsApp configurada reporta desconectada e callbacks de outro fluxo. Não foram ativados recebimentos, substituídos callbacks ou reutilizadas credenciais de outro sistema. Conectar esses componentes e comprovar o piloto real são dependências externas, não resultados presumidos do CI.

## Validação antes da integração

O head anterior desta revisão passou a suíte completa e revisão de código sem achados. O head final, com cache e identificadores de migração alinhados, exige nova execução completa e nova conferência pública. Não considerar publicação apenas porque a branch contém as alterações. Nenhuma proposta ou aditivo real será aprovado, enviado ou aplicado como efeito de publicação.

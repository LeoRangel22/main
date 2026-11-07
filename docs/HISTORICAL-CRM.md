# Histórico recuperado na página Clientes

A página Clientes oferece consulta do último lote histórico validado, com contas, contatos, eventos, conversas e oportunidades de retomada. O histórico do funil continua independente.

O acesso usa a sessão Master já existente. A função pública é invoker; a leitura privilegiada fica no schema não exposto event_crm_api e verifica conta, e-mail atual, bloqueio/exclusão e sessão em auth.sessions. Não há novas credenciais, funções de envio ou alteração comercial. O schema de dados event_crm e suas tabelas continuam sem grants diretos para anon, authenticated e service_role.

A busca aceita nomes com ou sem acentos, empresa, e-mail, telefone e datas brasileiras. A paginação é estável e a consulta pode ser limitada a uma conta. O detalhamento preserva valores e quantidades diferentes e oferece fontes paginadas com metadados; corpos integrais e caminhos de arquivos não são retornados pelo índice de fontes.

As informações recuperadas são evidências históricas: conversa não equivale a evento, reserva não comprova realização e documento financeiro não substitui conciliação. Ausência de satisfação permanece desconhecida. Responsáveis, telefones e vínculos antigos podem precisar de revalidação.

A interface limpa os dados na saída e ignora respostas atrasadas. A busca não é persistida no armazenamento do navegador. O painel e o diálogo são marcados para exclusão de captura de analytics. Nenhuma associação automática com propostas atuais é aplicada.

## Publicação e recuperação

Aplicar a migração revisada antes da interface. Verificar a assinatura da RPC, ACLs, isolamento das tabelas e o lote validado. Publicar somente o código e os testes: nenhuma base, contato ou documento deve entrar no artefato público.

O rollback supabase/rollback/historical_crm_owner_read.sql remove apenas a superfície de consulta e o schema de funções dedicado. Preserva dados importados, propostas, canais, configurações e tabelas operacionais. Não executar rollback nem repetir publicação após resultado incerto sem reconciliar o estado.

## Verificação

Os testes de banco usam somente PostgreSQL local descartável. Cobrem acesso negado, sessão revogada/expirada, conta excluída/bloqueada, identidade forjada, lote mais recente, busca, paginação, fontes, reexecução e rollback com dados preservados. Os testes de navegador usam dados sintéticos e nenhum envio externo.

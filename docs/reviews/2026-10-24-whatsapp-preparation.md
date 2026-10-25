# Candidato local: preparação de WhatsApp sem tentativa

Base: árvore da PR77 (`a98bf49`, integrada em `336a61e`). Não aplicado em produção.
Nenhum segredo, configuração, grant do Bot, callback, timer ou envio faz parte da instalação proposta.

## Contrato

1. A equipe revisa proposta, revisão, destinatário canônico, mensagem, título, última resposta e link. Se a política exigir gestor, somente o gestor designado e a aprovação vigente podem preparar.
2. `send-proposal-whatsapp` com `prepare:true` e `preparationExpiresAt` explícito em UTC consulta `event_whatsapp_preparation`. Retorna antes de claim, worker ou transporte, inclusive com o canal desligado. Isso não cria aprovação, reserva, contato, grant ou linha de outbox.
3. O retorno inclui `id`, `contextId`, `revision`, `purpose=event_proposal`, destinatário, corpo, prazo, `contentHash` e `reviewFingerprint`. O ID é o histórico existente para o mesmo fingerprint; para conteúdo novo, um UUID determinístico. Repetir a consulta não renova o prazo informado nem altera estado.
4. O hash do Bot mantém exatamente `JSON.stringify([2,tenant,id,contextId,revision,purpose,destination,body,expiresAt])`. `attempt` não altera essa identidade. `reviewFingerprint` protege adicionalmente revisão, token, prazo do link, resposta e aprovação no lado Eventos; não é credencial nem grant.
5. Futuro envio explícito apresenta o objeto `preparation` integral junto do conteúdo revisado. A Edge reconsulta o plano e recusa qualquer diferença; a nova RPC de claim repete a validação sob locks na ordem proposta → oportunidade → aprovação → outbox. Ela só então delega aos gates de revisão existentes.
6. Preparar não autoriza enviar: Bot exige seu grant exato, consentimento, prazo e política. Não existe fallback Z-API. `accepted`, entrega/leitura e resposta são evidências distintas; texto recebido não confirma venda, pagamento ou reserva.

O consumidor da ponte permanece o publicado: conta, scope/cursor, sendId, proposta, revisão, destino, providerId e referência de resposta são conferidos. Sem referência, revisão divergente ou resultado incerto, não há vinculação automática forçada. A PR145 e seu candidato local permanecem sob autoria do Bot; nenhum arquivo daquele repositório é alterado.

## Mudanças propostas para aprovação futura

- Criar `event_private.whatsapp_prepared_id(text)` e `event_private.whatsapp_canonical(text)`, sem EXECUTE para PUBLIC/anon/authenticated/service_role.
- Criar `public.event_whatsapp_preparation(uuid,bigint,text,text,text,timestamptz,uuid,timestamptz)`: **novo EXECUTE para authenticated**, com checagem de equipe/gestor no corpo. Só consulta dados já autorizados.
- Criar `public.begin_event_prepared_whatsapp_send(uuid,bigint,text,text,text,timestamptz,uuid,timestamptz,uuid,text)`: **novo EXECUTE para authenticated**, restrito aos mesmos gates comerciais. Este é o ato explícito de claim, separado da leitura.
- Substituir somente a sobrecarga de seis argumentos de `begin_event_send`: nova escolha determinística de ID para WhatsApp. Fingerprint, conflito, histórico, regras de retry, identidade/OID e ACL existentes são preservados; e-mail continua com UUID aleatório. A sobrecarga legada de cinco argumentos não é alterada nem exposta.
- Publicar, separadamente e só com aprovação aplicável, a Edge com modo de preparação e conferência do plano. Não há alteração da UI publicada neste incremento.

SECURITY DEFINER é necessário para consultar a política privada, não para contornar erro de acesso. Search path vazio, autorização explícita e revogação do EXECUTE padrão limitam a superfície. Referência: [Supabase — funções e privilégios](https://supabase.com/docs/guides/database/functions).

## Aplicação proposta e reversão

1. Confirmar heads, dono de publicação, ausência de concorrência e hashes dos artefatos. Concluir PostgreSQL nativo, upgrade, ACL, concorrência, rollback e regressão antes de pedir aplicação.
2. Obter aprovação nominal para a migração e as duas permissões acima. Aprovação de código local não é aprovação do SQL em produção.
3. Aplicação futura: migração primeiro, com gates de canal preservados; conferir OID/ACL antigos, ausência de alterações históricas e consulta sem tentativa. Publicar Edge depois, sob autorização própria.
4. Preparações antigas podem ficar inválidas após qualquer mudança de contexto. Refazer a revisão humana; nunca gerar outro ID para escapar de um envio accepted/sending/uncertain.
5. Reversão compatível: retirar o uso do novo modo na Edge; aplicar `supabase/rollback/whatsapp_readonly_preparation_compatibility.sql` somente com aprovação. Ela restaura o claim anterior e revoga as duas novas RPCs. Não remove histórico, IDs, mensagens, evidências, cursores ou helpers privados. Nenhum replay ou reset de fila faz parte da reversão.
6. Segredos, endereço, grants privados, callback e piloto interno continuam aprovações distintas. Não recriar nem importar por outra rota o pacote anterior indisponível.

## Aceite e limites

- SQL: preparação em transação READ ONLY; repetição; contexto obsoleto; autorização; mudança de contato; ID histórico; zero outbox antes do ato explícito; uma claim para dois cliques; rollback em falha; aceitação, entrega e resposta separadas; callback duplicado e correlação inválida.
- Concorrência nativa: dois preparadores e dois claimers; revogação do link enquanto o claim aguarda lock deve falhar sem nova linha.
- Edge: byte/hash idêntico ao Bot v2; sem leitura de segredo ou rede na preparação; conferência de hash, ID e contexto; erro, expiração, resposta inválida e timeout não autorizam retry automático.
- Testes locais não homologam configuração privada, execução GAS, UI comercial ou entrega real. A reconciliação do pacote original do Bot e CI do candidato conjunto permanecem pendentes.

Resultados executados e eventuais bloqueios são registrados no checkpoint desta tarefa; este documento descreve o contrato e não afirma aprovação de testes que ainda não rodaram.

## Compatibilidade com a segunda rodada do Bot

O manifesto local `package1-round2-review.json` informa candidato cumulativo `7079d27b7bc6b981d618f675aa07906bef4e745adc0525b1c7353d5c98a39be2`, base `cd842aae76426b8cd17d95711461aeb14bb4d692`. Sua leitura não constitui revisão integral daquele diff nem comprovação de CI ou runtime. O manifesto confirma `EventsDispatch.gs` inalterado e pacote original de recebimento ainda não reconciliado.

A futura admissão distingue `DEFERRED_PRIORITY`, `DEFERRED_CAPACITY`, `EXPIRED_NO_DISPATCH`, `UNKNOWN_REVIEW`, `ALREADY_ATTEMPTED`, `BLOCKED_REVIEW` e `READY`. Este candidato não cria um scheduler nem presume que esses estados já estejam publicados ou persistidos em Eventos. A apresentação e persistência desse contrato dependem da integração final do Bot, ainda bloqueada por aprovação específica. `claimable` significa somente elegibilidade no ledger de Eventos, nunca autorização, capacidade ou prioridade no Bot.

Preparação e claim revalidam o prazo pelo relógio real, inclusive após espera por lock. Resultado incerto conserva identidade e não permite nova tentativa automática. O claim libera a transação antes do HTTP; não mantém lock de banco durante rede. Uma edição depois da última conferência e antes do transporte permanece um limite de concorrência distribuída: a conferência da Edge e o grant exato do Bot restringem o risco, mas os testes locais não demonstram cancelamento de uma requisição externa já iniciada.

Nenhuma leitura de prioridade, nova janela, limite, credencial ou alteração de `EventsDispatch.gs` foi feita nesta tarefa. O bloqueio relatado pelo Bot não foi contornado.

## Evidências locais desta revisão

| Verificação | Resultado observado |
|---|---|
| Build do site | Concluído; nenhuma alteração de UI neste candidato |
| Suíte lógica completa | 655 testes aprovados, zero falhas |
| Navegador, dez arquivos pertinentes | 112 casos distintos: 110 aprovados na rodada inicial; dois excederam 35 segundos e passaram isoladamente, com um worker e o mesmo limite. Logs e traces iniciais preservados. Não se afirma ausência de instabilidade sob carga |
| PostgreSQL nativo 17.10, cluster descartável | Suíte completa aprovada: instalação nova, upgrade com histórico, upgrade sobre a ordem de produção, ACL/OID, cenários comerciais existentes e preparação |
| Concorrência da preparação | Duas leituras com mesma identidade e zero tentativa; duas claims geram uma tentativa; expiração durante lock e revogação concorrente recusam sem nova outbox |
| Recebimento sintético | Aceitação, entrega e resposta distintas; duplicatas idempotentes; destino/revisão incorretos recusados sem avançar cursor |
| Reversão de compatibilidade | Testada em transação; preserva ID histórico e revoga somente a superfície nova |
| `pg_dump` / `pg_restore` | **Não verificado**: o runtime portátil não inclui `pg_dump.exe` (`spawnSync ...pg_dump.exe ENOENT`). Nenhuma restauração foi iniciada. Gate de restore permanece para CI ou ambiente com cliente PostgreSQL completo |
| Produção, GAS, credenciais e envio real | Não alterados nem homologados por esta rodada |

Durante a construção dos testes, foram corrigidas três fixtures/expectativas: tentativa incerta deve existir no histórico, callbacks exigem `captured_at`, e a aprovação deve passar pela criação/decisão existentes com identidade coerente do gestor. As regras de produto e permissão não foram afrouxadas para fazer os testes passar. A revisão de código também corrigiu a expiração durante espera por lock usando `clock_timestamp()`, comprovada na suíte nativa final.

A última revisão separou também a leitura de configuração/segredo do transporte do modo `prepare:true`. O teste do handler HTTP verifica que a preparação lê somente URL/chave pública do Supabase para a sessão do usuário, sem consultar variáveis `EVENT_BOT_SEND_*`. A sondagem explícita `dryRun` e o envio posterior preservam seus gates anteriores. Não foi feita leitura ou alteração de valores reais de configuração nessa verificação.

Aceite limitado: candidato local disponível para revisão independente. Não publicar nem aplicar a migração com base somente nestes resultados. Permanecem revisão independente do patch, CI incluindo restore, reconciliação dos artefatos pendentes do Bot, integração final de prioridade/estados, autorização nominal das duas RPCs/EXECUTE e implantação separada da Edge. Configuração privada e piloto controlado continuam etapas próprias, sem reaproveitar autorização genérica.

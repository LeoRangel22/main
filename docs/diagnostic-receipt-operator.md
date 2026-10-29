# Operador de recibo diagnostico

A pagina `recibo-whatsapp.html` usa o SDK e a sessao existentes. Nao cria conta, permissao, credencial, grant ou mensagem. Nenhum telefone, corpo ou UUID real de piloto fica no bundle ou nos exemplos.

1. Entre no app com a conta Master existente. Abra a pagina e informe somente a referencia do piloto autorizado na coordenacao.
2. Consulte o recibo salvo. A RPC existente exige simultaneamente Master e proprietario; essa prova e invalidada se a referencia ou sessao mudar. O campo de referencia nao altera o pin do servidor.
3. Antes de abrir uma janela, comprove o fechamento dos controles em ambas as pontas e prepare o operador. O servidor exige o pin exato, prazo e controles de envio OFF.
4. Durante a janela coordenada, confirme a caixa e clique uma unica vez em Conciliar recibo existente. Isso chama apenas `event-whatsapp-pilot` com `action=reconcileReceipt` e `pilotId`. Nao chama previa, envio ou criacao de grant.
5. Se o resultado for incerto, nao repita a conciliacao. A pagina tenta somente ler o registro salvo e oferece consulta manual somente leitura. Um registro anterior ou a ausencia dele nao prova que uma chamada em voo terminou.
6. Feche e confira os controles nas duas pontas; retire os temporarios GAS conforme o plano aprovado. A pagina nao abre nem fecha esses controles automaticamente.

O marcador em sessionStorage e criado antes da invocacao e bloqueia repeticao nessa aba, inclusive apos recarga. E contencao de interface, nao contador global: nao impede uma chamada autorizada de outro navegador/aba. A idempotencia e a autorizacao continuam no servidor. Se o armazenamento falhar, a invocacao nao comeca. Nao limpar o marcador nem abrir outra aba para repetir resultado incerto.

A interface projeta uma lista fechada de metadados. Nao mostra o contexto retornado pela RPC, hash, identificadores do provedor, erros brutos ou credenciais. Resposta registrada nao inventa callback de entrega/leitura. Troca de sessao apaga a evidencia visivel e nao repete a acao.

Validacao: testes de navegador com SDK simulado e toda rede externa bloqueada cobrem negativas de autenticacao/papel/propriedade, alteracao da referencia, clique duplo, recarga, erro, resultado incerto, readback, troca de sessao, falha de armazenamento e teclado em viewport movel. Nao equivalem a homologacao real da janela.

Reversao do app: retirar somente os dois assets e suas entradas na allowlist de build. Isso nao apaga recibos, modifica banco/Edge ou restaura uma versao antiga do GAS. Fechar controles antes de qualquer reversao. Nenhuma migracao ou grant faz parte desta entrega.

Espera limitada: identidade/autorizacao e leitura salva tem limite de 8 segundos por etapa; a conciliacao passa a resultado incerto apos 30 segundos sem resposta. Esse limite da interface nao cancela a operacao em voo nem prova rollback. Nao repetir: consultar somente o recibo salvo e encerrar os controles coordenados. Respostas tardias nao substituem o estado incerto automaticamente. Falha de inicializacao do SDK mostra orientacao sem liberar a area restrita.

Same-identity SIGNED_IN, TOKEN_REFRESHED and INITIAL_SESSION notifications preserve the selected reference, ownership proof and attempt marker. SIGNED_OUT, missing/different identity, USER_UPDATED and PASSWORD_RECOVERY still invalidate the UI. Explicit saved reads and reconciliation continue to revalidate the authenticated identity, Master role and exact ownership on the server; no reconciliation or Edge invocation is started by an auth event; reloads after invalidating events are read-only. No Auth/RPC calls run inside the synchronous SDK callback. This fixes a reproduced same-user notification failure; the event behind the live incident was not recorded.

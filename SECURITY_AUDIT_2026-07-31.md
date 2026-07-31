# RELATÓRIO DE SEGURANÇA — Bel do Frango ATU — 2026-07-31

## Aviso importante antes de tudo

O prompt de auditoria descreve um **SaaS multi-tenant white-label com Super Admin via API key e pagamentos Mercado Pago (PIX)**. Isso **não corresponde ao que existe neste repositório**. Verifiquei diretamente:

- `schema.prisma` — nenhum campo `tenantId`/`empresaId` em nenhum model. É um sistema **single-tenant** (uma galeteria só, "Bel do Frango").
- Nenhuma referência a `mercadopago`, `webhook`, `x-signature` em todo `backend/src` — `FormaPagamento` (PIX/CARTAO/DINHEIRO) é só um campo registrado no pedido; não existe gateway de pagamento integrado.
- Nenhum `Dockerfile`, `docker-compose.yml` ou config de Nginx no repositório — infraestrutura de deploy não está versionada aqui.
- Não existe conceito de "Super Admin" nem API key entre serviços.
- `src/`, `scripts/lint`, `tsconfig.json` na raiz são scaffold de um projeto React/TS **não utilizado** (o app real é HTML estático + `scripts/support.js`, servido por `live-server`). `package.json` raiz confirma: `"build": "echo 'Build setup needed...'"`.

Segui a **Regra 1 (Korentech)** — não assumo, não escondo a divergência. Auditei o que **de fato existe**: backend Express/Prisma/Postgres + 4 apps HTML (cliente, admin, garçom, entregador, atendente). Onde uma seção do checklist original não se aplica (0.4 Mercado Pago, 0.8/0.9 infra Docker/Nginx/VPS), marco **N/A — não existe no repo** em vez de inventar achados. Se a stack real incluir isso em outro lugar (VPS, outro repo de infra), me diga onde e eu re-auditando.

## Resumo

- **Críticos: 1** | **Altos: 2** | **Médios: 4** | **Baixos: 3** | **N/A (fora do escopo do repo): 3 seções**

Achado geral: a base de código está **bem acima da média** do que normalmente se vê num protótipo — preço sempre recalculado no servidor, cookies httpOnly, CORS com whitelist, JWT_SECRET com fail-closed no boot, uploads com nome aleatório, sem mass assignment, sem SQL raw, `npm audit` limpo (0 vulnerabilidades). Os achados abaixo são gaps reais, não problemas genéricos de "poderia ser melhor".

---

## Achados

### [CRÍTICO] Senhas padrão hardcoded no script de seed — risco de conta admin com senha conhecida em produção
- Arquivo: `backend/prisma/seed.js:177-199`
- Prova:
  ```js
  const senhaAdmin = process.env.SEED_ADMIN_SENHA || 'BelDoFrangoAtu@2026';
  ...
  const senhaGarcom = process.env.SEED_GARCOM_SENHA || 'GarcomBelDoFrango@2026';
  ...
  const senhaAtendente = process.env.SEED_ATENDENTE_SENHA || 'AtendenteBelDoFrango@2026';
  ```
  `backend/.env.example` **não define** `SEED_ADMIN_SENHA`, `SEED_GARCOM_SENHA` nem `SEED_ATENDENTE_SENHA` — nada avisa o operador que precisa setá-las.
- Risco: se `npm run db:seed` rodar em produção (ou em qualquer ambiente) sem essas três variáveis definidas, os logins `admin@beldofrango.com`, `garcom@beldofrango.com` e `atendente@beldofrango.com` são criados com senhas que estão **em texto puro no histórico do Git**, públicas para qualquer um com acesso ao repositório. É credencial padrão conhecida — o mesmo tipo de risco que `JWT_SECRET` já trata como fatal em `server.js:16-23` (fail-closed), mas aqui o seed falha **aberto** (usa o default silenciosamente).
- Correção proposta: seguir o mesmo padrão do `JWT_SECRET` — se `SEED_ADMIN_SENHA`/`SEED_GARCOM_SENHA`/`SEED_ATENDENTE_SENHA` não estiverem definidas E `NODE_ENV === 'production'`, abortar o seed (`process.exit(1)`) em vez de usar o fallback. Em dev, manter o fallback (ok, é só local).

### [ALTO] Sessão (JWT) não é revogada no logout nem na troca de senha
- Arquivo: `backend/src/controllers/authController.js:52-55` (e o mesmo padrão em `entregadorAuthController.js`, `garcomAuthController.js`, `atendenteAuthController.js`)
- Prova:
  ```js
  function logout(req, res) {
    res.clearCookie(NOME_COOKIE, opcoesCookie());
    res.json({ ok: true });
  }
  ```
  O JWT não carrega `jti`/versão, e não existe nenhuma tabela/lista de revogação consultada em `middleware/auth.js`. `alterarSenha` (linha 79-81) também só troca o hash — não invalida tokens já emitidos.
- Risco: um token roubado (XSS em outro ponto do stack, malware no dispositivo, log vazado) continua válido por até 12h mesmo depois que a vítima faz logout ou troca a senha porque "foi comprometida". O checklist original (0.1) pede exatamente essa invalidação server-side.
- Correção proposta: opção mínima e cirúrgica — adicionar coluna `senhaAlteradaEm DateTime` (ou reaproveitar `updatedAt`) em `Admin`/`Garcom`/`Entregador`/`Atendente`, incluir `iat` implícito do JWT, e no middleware comparar `payload.iat` contra `senhaAlteradaEm`; se o token foi emitido antes da última troca de senha, rejeitar. Cobre o caso mais crítico (senha trocada por suspeita de vazamento) sem precisar de uma tabela de blacklist completa.

### [ALTO] `NODE_ENV` ausente no `.env` local — cookies de sessão podem não sair com `Secure` em produção se o mesmo esquecimento se repetir no deploy
- Arquivo: `backend/.env:1-3` (ausência), usado em `backend/src/controllers/authController.js:13`, `garcomAuthController.js:13`, `entregadorAuthController.js:13`, `atendenteAuthController.js:13`
- Prova: `backend/.env` atual só tem `JWT_SECRET`, `FRONTEND_URL`, `PORT` — **sem `NODE_ENV`**. O código faz `secure: process.env.NODE_ENV === 'production'`. Sem essa variável setada explicitamente, `NODE_ENV` fica `undefined`, a condição é `false`, e o cookie de sessão (admin/garçom/entregador/atendente) sai **sem o atributo `Secure`**.
- Risco: se o `.env` de produção tiver o mesmo esquecimento (é o padrão comum: copiar `.env.example`, preencher só o óbvio), o cookie de sessão httpOnly passa a trafegar também por HTTP puro, não só HTTPS — abre janela pra roubo de sessão em rede insegura/downgrade. Também afeta o comportamento padrão do Express: sem `NODE_ENV=production`, `app.get('env')` cai em `'development'`, e o handler de erro padrão do Express (que só existe implicitamente, não há um handler global custom em `server.js`) fica mais verboso em erros não capturados.
- Correção proposta: mesmo padrão do `JWT_SECRET` — falhar o boot se `NODE_ENV` não for exatamente `'production'` ou `'development'`, e documentar no `.env.example`/`SECURITY.md` que `NODE_ENV=production` é obrigatório no deploy real. Cirúrgico: adicionar 3-4 linhas perto do check de `JWT_SECRET` em `server.js`.

### [MÉDIO] `bcrypt.hash(senha, 10)` — custo abaixo do recomendado (≥12)
- Arquivos: `authController.js:79`, `entregadorAuthController.js:79`, `garcomAuthController.js:79`, `atendenteAuthController.js:79`, `entregadorController.js:29,56`, `garcomAdminController.js:29,56`, `atendenteAdminController.js` (mesmo padrão), `seed.js:178,186,194`
- Prova: `await bcrypt.hash(String(novaSenha), 10)` — custo 10 em todos os pontos, consistente.
- Risco: custo 10 ainda é razoável hoje, mas fica cada vez mais barato de atacar offline (se o hash vazar) conforme hardware evolui. Não é urgente, mas é uma correção de 1 caractere com custo zero de compatibilidade (hashes antigos continuam validando normalmente com bcrypt, o custo é por hash).
- Correção proposta: trocar `10` por `12` em todos os pontos listados (uma constante `BCRYPT_COST = 12` centralizada evitaria repetição, mas isso é decisão de refatoração — não fiz agora pra não misturar com a Fase 0).

### [MÉDIO] Rate limit de login é só por IP, sem bloqueio por conta
- Arquivo: `backend/src/server.js:108-114`
- Prova: `limitadorLogin` usa `express-rate-limit` padrão (chave = IP), 4 tentativas/min, aplicado em `/api/auth/login`, `/api/garcom/login`, `/api/entregador/login`, `/api/atendente/login`.
- Risco: um atacante distribuído (várias origens/IPs, ex. lista de proxies) pode tentar senhas contra uma conta específica sem esbarrar no limite — o limite protege contra flood de um único IP, não contra brute-force direcionado a uma conta.
- Correção proposta: opcional para depois — contador adicional por `email` normalizado (ex. Map em memória com TTL, ou coluna `tentativasFalhas`/`bloqueadoAte` no banco) com backoff progressivo. Dado o porte do sistema (login de staff, não de clientes finais), isso é "nice to have", não bloqueador.

### [MÉDIO] Sem fluxo de "esqueci minha senha" — não é uma falha, mas fecha uma seção do checklist
- Arquivos: `authController.js`, `garcomAuthController.js`, `entregadorAuthController.js`, `atendenteAuthController.js`
- Observação: não existe reset de senha por e-mail/token; a única forma de trocar senha é `alterarSenha` sabendo a senha atual, ou o admin resetando via painel (`PUT /admin/garcons/:id` etc. aceita `senha` nova direto). Isso é seguro (não há superfície de token de reset pra atacar), só não é uma "correção" no sentido do checklist — é a ausência da feature. Sem ação recomendada a menos que vocês queiram adicionar self-service de reset.

### [MÉDIO] `express.json()` sem limite explícito de payload
- Arquivo: `backend/src/server.js:91`
- Prova: `app.use(express.json());` — sem `{ limit: '1mb' }`. O default do Express é `100kb`, que já é uma proteção razoável, mas não é explícito/documentado no código.
- Correção proposta: `app.use(express.json({ limit: '1mb' }));` — cosmético/defesa em profundidade, não é um risco real hoje dado o default de 100kb.

### [BAIXO] `.env.example` da raiz é boilerplate de um projeto React inexistente
- Arquivo: `.env.example` (raiz)
- Prova: refere-se a `REACT_APP_API_URL`, `REACT_APP_FIREBASE_*` — nada disso é usado pelo app real (HTML estático + `backend/.env.example` é o que importa). Não é um risco de segurança, mas confunde quem for configurar o ambiente e pode levar a "proteger a variável errada".
- Correção proposta: apagar ou marcar claramente como scaffold não utilizado — decisão do time, não fiz nada aqui.

### [BAIXO] `dc-runtime` (scripts/support.js) usa `new Function(...)` para avaliar `<script data-dc-script>` e módulos `x-import`
- Arquivo: `scripts/support.js:696-703` (`evalDcLogic`) e `:1033-1039` (`x-import` loader)
- Análise: já marcado no próprio arquivo com `//! nosemgrep: eval-and-function-constructor` pelos autores da ferramenta (é gerado, não escrito por vocês). Verifiquei o caminho de dados: o conteúdo avaliado vem sempre do HTML do próprio documento (`<script data-dc-script>` dentro dos `.dc.html`) ou de uma URL fixa no atributo `from`/`src` do `x-import` — o código explicitamente **proíbe** que esse atributo seja dinâmico (`{{...}}`). Não encontrei nenhum caminho onde input de usuário (query string, body, campo de formulário) chegue a esses `eval`s. É equivalente em risco a um `<script>` inline normal do navegador.
- Correção proposta: nenhuma ação necessária — documentando só para não ser encontrado de novo em varredura automatizada e re-investigado do zero.

### [N/A] 0.4 Checkout e Pagamentos (Mercado Pago) — sem gateway integrado no repo
Preço/subtotal/taxa/total **são** recalculados no servidor (`pedidoController.js:157-178`, `mesaController.js:212-216` — bom, já está correto). Mas não existe webhook, `x-signature`, nem chamada à API do Mercado Pago em lugar nenhum do código. Se o pagamento PIX/Cartão for processado fora deste backend (maquininha, link externo, WhatsApp), não há o que auditar aqui — preciso saber onde essa integração vive para revisar.

### [N/A] 0.8/0.9 Banco de dados / Docker / Nginx / VPS — infraestrutura não versionada neste repositório
Sem `docker-compose.yml`, `Dockerfile`, config de Nginx, nem scripts de provisionamento de VPS no repo. Não consigo confirmar exposição da porta 5432, usuário do Postgres, TLS do Nginx, firewall (`ufw`), SSH, `fail2ban` etc. a partir do código-fonte. Preciso de acesso ao repo de infra (ou aos arquivos na VPS) pra auditar essa parte.

### [N/A] 0.2 Isolamento multi-tenant — não se aplica, sistema é single-tenant
Não existe `tenantId` em nenhum model do `schema.prisma`. IDOR entre "tenants" não é uma superfície de ataque aqui porque só existe uma loja. (IDOR entre *pedidos de clientes diferentes* foi checado e está coberto — ver nota positiva abaixo.)

---

## O que já está correto (não são achados, mas vale registrar por que não refiz o trabalho)

- **IDOR de pedido**: `buscarPorCodigo` usa `codigoAcompanhamento` (UUID), nunca o `id` sequencial — comentário no próprio código (`pedidoController.js:237-240`) mostra que isso já foi corrigido intencionalmente.
- **Preço nunca vem do cliente**: todo o cálculo de subtotal/desconto/frete/total em `criarPedidoInterno` e em `mesaController.recalcularTotal` busca do banco — testei a leitura completa do fluxo, não há campo de preço aceito do `req.body`.
- **RBAC por role**: 4 middlewares (`autenticarAdmin/Garcom/Entregador/Atendente`) com cookies e rotas totalmente segregados — não achei nenhuma rota de admin acessível por garçom/atendente/entregador ou vice-versa.
- **Upload**: nome de arquivo gerado por `crypto.randomBytes(16)` no servidor (nunca o nome do cliente), `fileFilter` por mimetype + limite de 5MB — dentro do razoável para o volume desse sistema. (Magic-number real via `sharp`/`file-type` seria mais robusto que mimetype declarado pelo cliente, mas não achei uso de `sharp` no repo apesar do prompt mencionar — se vocês pretendem usar `sharp` para reprocessar a imagem, isso reforçaria essa camada; hoje não é usado.)
- **CORS/Helmet**: whitelist explícita de origem (não há `origin: '*'`), CSP restritiva (`default-src: 'none'`), sem stack trace vazando em nenhum dos ~20 controllers lidos (todos usam `console.error` + mensagem genérica).
- **`npm audit`** (backend, prod deps): 0 vulnerabilidades.
- **Segredos no Git**: só `.env.example` (com placeholders) foi commitado, nunca o `.env` real — confirmei varrendo todo o histórico do Git por commits que tocam `.env`.
- **Mass assignment**: nenhum controller passa `req.body` inteiro pro Prisma — todos fazem whitelist campo a campo.

---

## Plano de correção sugerido (ordem por risco)

1. **[CRÍTICO]** `seed.js` — falhar (não usar default) se `SEED_ADMIN_SENHA`/`SEED_GARCOM_SENHA`/`SEED_ATENDENTE_SENHA` ausentes em produção.
2. **[ALTO]** Invalidar sessões na troca de senha (comparar `iat` do JWT com timestamp da última troca).
3. **[ALTO]** `NODE_ENV` obrigatório no boot (mesmo padrão fail-closed do `JWT_SECRET`).
4. **[MÉDIO]** Custo do bcrypt 10 → 12 em todos os pontos.
5. **[MÉDIO]** Rate limit de login por conta, além de por IP (opcional, priorizar se houver sinal de brute-force real).
6. **[MÉDIO]** `express.json({ limit: '1mb' })` explícito.
7. **[BAIXO]** Limpar `.env.example` da raiz (scaffold React não usado).

Pendências que preciso de você para avançar:
- Onde vive a integração de pagamento (Mercado Pago) de fato, se existir fora deste repo?
- Onde ficam os arquivos de infraestrutura (Docker/Nginx/VPS) para eu auditar 0.8/0.9?
- Confirmar se este é realmente o modelo de negócio (single-tenant, uma loja) ou se "multi-tenant white-label" é uma direção futura ainda não implementada — isso muda a prioridade dos achados.

**PARE AQUI. Aguardando aprovação antes de implementar qualquer correção da Fase 1.**

# Segurança — Bel do Frango ATU

Este documento resume as decisões de segurança do backend e o que fazer em caso de incidente. Complementa o relatório de auditoria em `SECURITY_AUDIT_2026-07-31.md` (achados e prova por arquivo/linha).

## Escopo

Sistema **single-tenant** (uma loja): backend Express/Prisma/Postgres + apps HTML para cliente, admin, garçom, entregador e atendente. Não há gateway de pagamento integrado (PIX/Cartão são só campos registrados no pedido) nem infraestrutura de Docker/Nginx/VPS versionada neste repositório.

## Rotas públicas e justificativa

Todas as rotas abaixo **não** exigem sessão. Todo o resto do backend passa por `autenticarAdmin`/`autenticarGarcom`/`autenticarEntregador`/`autenticarAtendente` (`backend/src/middleware/auth.js`).

| Rota | Método | Por que é pública |
|---|---|---|
| `/api/health` | GET | Healthcheck de infraestrutura |
| `/api/auth/login`, `/api/garcom/login`, `/api/entregador/login`, `/api/atendente/login` | POST | É o próprio login — sujeito a rate limit por IP (`limitadorLogin`) e por conta (`loginThrottle.js`) |
| `/api/auth/logout`, `/api/garcom/logout`, `/api/entregador/logout`, `/api/atendente/logout` | POST | Só limpa o cookie; sem dado sensível |
| `/api/categorias`, `/api/subcategorias`, `/api/produtos`, `/api/produtos/:id`, `/api/proteinas`, `/api/complementos`, `/api/marmita-tamanhos`, `/api/banners` | GET | Catálogo do cardápio — precisa ser visível antes do cliente logar (guest checkout) |
| `/api/configuracao` | GET | Taxa de entrega, exibida no checkout antes de qualquer autenticação |
| `/api/cupons/validar` | POST | Só confirma se o cupom existe/está ativo — o desconto real é recalculado no servidor na criação do pedido, nunca aceito daqui |
| `/api/pedidos` | POST | Guest checkout (sem login) — preço/subtotal/total sempre recalculados no servidor a partir do catálogo (`pedidoController.criarPedidoInterno`) |
| `/api/pedidos/:codigo` | GET | Busca por `codigoAcompanhamento` (UUID), nunca pelo `id` sequencial — evita IDOR (enumerar pedidos de outros clientes) |
| `/uploads/*` | GET (estático) | Fotos de produto/categoria/banner — conteúdo público por natureza (aparece no cardápio) |

## Política de tokens/sessão

- JWT assinado com `HS256`, `JWT_SECRET` validado no boot (`server.js`): recusa subir se ausente, curto (<32 chars) ou um valor padrão conhecido.
- Token fica em cookie `httpOnly` + `sameSite=lax` + `secure` (quando `NODE_ENV=production`) — nunca em `localStorage`/`Authorization` header.
- Validade: 12h, sem refresh token (arquitetura de sessão única, adequada ao porte do sistema — login de staff, não de milhões de clientes finais).
- **Revogação server-side**: cada papel (`Admin`/`Garcom`/`Entregador`/`Atendente`) tem `senhaAlteradaEm`. O middleware rejeita qualquer token emitido (`iat`) antes da última troca de senha — cobre tanto a troca pelo próprio usuário quanto o reset feito pelo admin. Contas com `ativo=false` (garçom/entregador/atendente) também são rejeitadas na hora, mesmo com token ainda válido.
  - **Pendente**: os campos `senhaAlteradaEm` foram adicionados ao `schema.prisma` e o Prisma Client já foi regenerado, mas a migration ainda não rodou contra o banco (faltou `DATABASE_URL` no ambiente onde a auditoria foi feita). Rodar `npx prisma migrate dev --name add_senha_alterada_em` (dev) ou gerar o SQL com `prisma migrate diff` e aplicar com `prisma migrate deploy` (produção) antes de considerar essa correção ativa.
- Bloqueio de brute-force: rate limit por IP (`express-rate-limit`, 4 tentativas/min nas rotas de login) **e** por conta (`backend/src/utils/loginThrottle.js`, em memória — 5 falhas seguidas bloqueiam a conta com backoff progressivo de 30s até 5min).

## Rotação de segredos

- `JWT_SECRET`: gerar com `openssl rand -base64 48`. Rotacionar invalida **todas** as sessões ativas de todos os papéis imediatamente (é a mesma chave para admin/garçom/entregador/atendente) — avisar a equipe antes de trocar em produção.
- `SEED_ADMIN_SENHA` / `SEED_GARCOM_SENHA` / `SEED_ATENDENTE_SENHA`: obrigatórias em `NODE_ENV=production` — o seed (`backend/prisma/seed.js`) aborta antes de tocar o banco se alguma estiver ausente. Usadas só na primeira criação da conta (via `upsert`); trocar a senha depois é feito pelo painel, não rodando o seed de novo.
- `DATABASE_URL`: nunca commitada (`.env` está no `.gitignore`, confirmado sem histórico no Git). Ao rotacionar a senha do Postgres, atualizar o `.env` e reiniciar o processo (PM2/Docker).
- Depois de qualquer rotação de segredo por suspeita de vazamento: reiniciar o processo do backend (invalida `JWT_SECRET` em memória se ele mudou) e, se for vazamento de senha de conta específica, usar a troca de senha normal — agora ela já revoga a sessão antiga (ver seção anterior).

## Resposta a incidente (mínimo viável)

1. **Suspeita de conta comprometida** (admin/garçom/entregador/atendente): trocar a senha da conta pelo painel (ou pedir pra ela mesma trocar) — a sessão antiga é revogada automaticamente pelo `senhaAlteradaEm`. Para garçom/entregador/atendente, também dá pra desativar a conta (`ativo=false`) imediatamente, o que já bloqueia qualquer sessão em aberto.
2. **Suspeita de `JWT_SECRET` vazado**: gerar novo com `openssl rand -base64 48`, atualizar `.env`, reiniciar o processo. Derruba todas as sessões de todos os papéis de uma vez — avisar a equipe.
3. **Suspeita de senha padrão do seed usada em produção**: trocar a senha de `admin@beldofrango.com`, `garcom@beldofrango.com` e `atendente@beldofrango.com` pelo painel imediatamente; conferir os logs de pedido/alteração de preço no período suspeito.
4. **Erro 500 recorrente ou payload suspeito**: os logs de erro (`console.error`) ficam no processo (PM2/Docker) — nunca incluem senha, token ou dado de pagamento; incluem stack trace só no log do servidor, nunca na resposta ao cliente.

## O que ficou fora deste ciclo (decisão consciente, não esquecimento)

- Fluxo de "esqueci minha senha" — não existe, e não é uma falha: a superfície de ataque de um token de reset por e-mail é maior que a de exigir a senha atual (usuário) ou reset manual pelo admin (staff). Adicionar só se vocês quiserem self-service.
- `.env.example` da raiz (boilerplate de projeto React não usado) — cosmético, decisão do time.
- Integração de pagamento (Mercado Pago) e infraestrutura (Docker/Nginx/VPS) — não existem neste repositório; auditar separadamente onde esse código de fato vive.

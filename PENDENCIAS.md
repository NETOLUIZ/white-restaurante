# Pendências — ajustar na outra máquina

Contexto: `SECURITY_AUDIT_2026-07-31.md` (relatório completo) e `SECURITY.md` (política/decisões). Das 6 correções aprovadas na Fase 1, 5 já estão ativas. Falta 1.

## 1. Rodar a migration do campo `senhaAlteradaEm` (bloqueador)

O que falta: aplicar contra um Postgres de verdade a migration que adiciona `senhaAlteradaEm DateTime?` em `Admin`, `Garcom`, `Entregador` e `Atendente` (`backend/prisma/schema.prisma`). O código do middleware (`backend/src/middleware/auth.js`) e dos controllers de troca de senha já leem/gravam esse campo — só não tem efeito real até a coluna existir no banco.

Por quê: sem essa coluna, logout e troca de senha não revogam o JWT já emitido (ele continua válido até as 12h expirarem sozinhas). Ver achado **[ALTO]** no relatório.

Passos na outra máquina:
```bash
cd backend
# confirme que .env tem DATABASE_URL apontando pro Postgres certo
npx prisma migrate dev --name add_senha_alterada_em
npm run dev   # ou npm start
```

Como verificar que funcionou:
1. Login (qualquer papel) → guarda o cookie.
2. Chama a rota de trocar senha (`PUT /api/auth/senha` ou equivalente do papel) com a senha atual.
3. Tenta usar o cookie antigo numa rota protegida → deve vir **401** (antes da migration, continuava autenticado).

## 2. `backend/.env` sem `DATABASE_URL`

Nesta máquina o `.env` só tinha `JWT_SECRET`, `FRONTEND_URL`, `PORT` e (adicionado agora) `NODE_ENV`. Nenhuma operação que toca o banco funciona localmente (seed, migration, qualquer request que use Prisma) até isso ser preenchido. Provavelmente já está resolvido na outra máquina — só deixando registrado por que a migration acima não pôde ser testada/rodada aqui.

## 3. Processos duplicados do `live-server` (cosmético, não é segurança)

Nesta máquina sobraram 2-3 instâncias do `live-server` (frontend, porta 5000) rodando ao mesmo tempo de sessões anteriores. Não afeta segurança, só desperdiça recursos. Se acontecer na outra máquina: `taskkill` nos processos `node scripts/dev-server.js` extras, deixando só um.

## Já resolvido (não precisa mexer)

1. ✅ Seed com senha padrão hardcoded — aborta em produção sem `SEED_ADMIN_SENHA`/`SEED_GARCOM_SENHA`/`SEED_ATENDENTE_SENHA`.
2. ⏳ Sessão não revogada no logout/troca de senha — código pronto, **migration pendente (item 1 acima)**.
3. ✅ `NODE_ENV` obrigatório no boot.
4. ✅ Custo do bcrypt 10→12 em todos os pontos.
5. ✅ Rate limit de login por conta (além de por IP), com backoff progressivo.
6. ✅ `express.json` com limite explícito de 1MB.

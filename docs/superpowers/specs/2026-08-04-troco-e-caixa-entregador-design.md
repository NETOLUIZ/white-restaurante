# Spec: Troco visível para o entregador + saldo de caixa por entregador

**Data:** 2026-08-04
**Status:** Aprovado

---

## Resumo

Hoje o cliente informa no checkout "troco pra quanto?" quando paga em Dinheiro, mas esse valor é calculado só na tela do cliente e **nunca é enviado ao backend** (decisão documentada em `pedidoController.js`: "o entregador confirma o valor na hora"). O entregador não vê essa informação em lugar nenhum.

Esta spec:
1. Passa a enviar e guardar o valor de troco indicado pelo cliente, exibindo-o no card do entregador.
2. Adiciona um saldo em dinheiro por entregador — quanto ele acumulou em pedidos pagos em Dinheiro e ainda não "devolveu" (prestou contas) para o restaurante — visível na tela dele e numa aba nova do Admin, com botão para o Admin zerar o saldo.
3. Mantém e reforça o botão "Abrir no Mapa" que já existe (inicia navegação no Google Maps a partir do endereço do pedido).

Aplica-se a **todos os tenants** — mudança em schema/backend/frontend compartilhado, sem nada específico de uma loja.

Fora de escopo (YAGNI, não pedido): histórico/auditoria de zeramentos passados; qualquer vínculo com o model `Caixa` existente (esse é por tenant/dia, não por entregador — ficam separados).

---

## 1. Modelo de dados

### Alteração em `Pedido`

```prisma
model Pedido {
  // ...campos existentes
  valorTrocoPara Float?   // só relevante quando formaPagamento = DINHEIRO; null = sem troco / pagamento exato
}
```

### Alteração em `Entregador`

```prisma
model Entregador {
  // ...campos existentes
  saldoZeradoEm DateTime?  // null = conta desde a criação do entregador; setado toda vez que o Admin zera o saldo
}
```

Migration: gerar via `prisma migrate dev` em dev; em produção, `prisma migrate deploy` só após confirmação explícita do usuário (mesma regra já seguida no projeto).

---

## 2. Cálculo do saldo do entregador (derivado, não guardado)

```
saldo(entregadorId) = SUM(pedido.total)
  WHERE pedido.entregadorId = :entregadorId
    AND pedido.formaPagamento = 'DINHEIRO'
    AND pedido.statusEntrega = 'ENTREGUE'
    AND pedido.createdAt > (entregador.saldoZeradoEm OR entregador.createdAt)
```

Só conta pedidos **ENTREGUE** (ele só fica de posse do dinheiro depois de entregar de verdade) e só **DINHEIRO** (PIX/Cartão não passam pela mão dele). "Zerar" = setar `saldoZeradoEm = now()`; nada é apagado, só some da soma daí pra frente.

---

## 3. Backend

### `criarPedidoInterno` (pedidoController.js)
- Aceita `valorTrocoPara` no body do checkout (opcional).
- Validação (mesmo padrão de `LIMITES_ENDERECO`): só aceita se `tipo === 'ENTREGA'` e `formaPagamento === 'DINHEIRO'`; se vier, precisa ser número > 0 e >= `total` do pedido (não faz sentido "troco" pra um valor menor que o pedido) — senão `Erro400`.
- Grava `valorTrocoPara` direto no `create` do pedido.

### `entregadorController.js`
- `meusPedidos`: inclui `valorTrocoPara` na resposta de cada pedido (ao lado de `endereco`, `formaPagamento`).
- Nova função `meuSaldo(req, res)`: roda a query da seção 2 pro `req.entregador.id`, devolve `{ saldo }`.

### Novas rotas (`routes/entregador.js`)
| Método | Rota | O que faz |
|---|---|---|
| GET | `/api/entregador/saldo` | Saldo do entregador autenticado |

### Novas rotas admin (`entregadorController.js` — é do próprio tenant, não do super admin)
| Método | Rota | O que faz |
|---|---|---|
| GET | `/api/admin/entregadores/saldos` | Lista todos os entregadores do tenant com nome + saldo atual (reusa a query da seção 2 por entregador) |
| POST | `/api/admin/entregadores/:id/zerar-saldo` | Seta `saldoZeradoEm = now()` pro entregador `:id` |

---

## 4. Frontend — Checkout (`index.html`)

- `finalizarPedido()`: quando `s.payment === 'money'` e `s.valorRecebido` preenchido, inclui `valorTrocoPara: parseFloat(...)` no payload de `POST /pedidos` (mesmo cálculo que já existe pra exibir na tela, só que agora também envia).

---

## 5. Frontend — Entregador (`entregador.html`)

### Card do pedido
- Ao lado de `pgtoLabel` (já corrigido pra distinguir Dinheiro), quando `formaPagamento === 'DINHEIRO'` e `valorTrocoPara` existir: mostra "Troco pra R$50,00 (dar R$20,00)" — o "dar" é `valorTrocoPara - total`.
- Botão "Abrir no Mapa" continua exatamente como está (já usa `enderecoParaMaps`, já inclui CEP do fix anterior) — sem mudança aqui, só confirmando que fica.

### Topo da tela (`isPedidos`)
- Novo bloco fixo no topo mostrando o saldo atual: "Você deve devolver: R$X" (busca em `GET /entregador/saldo` no load da tela e depois de cada pedido marcado como entregue).

---

## 6. Frontend — Admin (`Bel do Frango - Admin.dc.html`)

### Nova aba "Caixa dos Entregadores"
- Novo item no menu lateral (`data-feature="entregador"`, mesmo guard da aba "Entregadores" existente).
- Lista todos os entregadores do tenant: nome, saldo atual (`GET /admin/entregadores/saldos`), botão "Zerar" por linha (`POST /admin/entregadores/:id/zerar-saldo`, com confirmação — ação que "apaga" o controle de quanto ele devia, então pede um `confirm()` antes de mandar).
- Sem histórico nessa versão — só o estado atual.

---

## 7. Testes / verificação manual

1. Cliente faz pedido Dinheiro, preenche "troco pra R$50" → confere no banco que `valorTrocoPara = 50`.
2. Entregador vê "Troco pra R$50,00 (dar R$20,00)" no card.
3. Admin marca pedido como Entregue → saldo do entregador sobe no valor do pedido, tanto na tela dele quanto na aba nova do Admin.
4. Admin clica "Zerar" → saldo volta a 0 pra esse entregador; pedidos futuros voltam a somar normalmente.
5. Repetir com um segundo tenant (ex: `msalete`, se tiver feature `entregador` ligada) — confirmar que o saldo é isolado por tenant (via `req.prisma` escopado, mesma proteção já usada no resto do projeto).

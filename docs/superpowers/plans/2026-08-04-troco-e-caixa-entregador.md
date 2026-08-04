# Troco visível + saldo de caixa por entregador — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer o valor de troco indicado pelo cliente no checkout chegar até a tela do entregador, e dar a cada entregador um saldo de dinheiro (pedidos Dinheiro entregues) visível na tela dele e numa aba nova do Admin, com botão pro Admin zerar.

**Architecture:** `Pedido` ganha um campo `valorTrocoPara` gravado no checkout. `Entregador` ganha `saldoZeradoEm`. O saldo em si NÃO é uma coluna — é sempre calculado na hora via query (`SUM(total) WHERE formaPagamento=DINHEIRO AND statusEntrega=ENTREGUE AND createdAt > saldoZeradoEm`), exposto por 2 rotas novas (uma pro próprio entregador, uma pro admin listar todos). Front: checkout envia o valor que já calcula hoje; `entregador.html` mostra troco no card + saldo no topo; Admin ganha aba nova "Caixa dos Entregadores".

**Tech Stack:** Node/Express/Prisma/PostgreSQL (backend), HTML + DC runtime custom (`.dc.html`/`.html` com `<script type="text/x-dc">`, sem framework), Docker Compose, deploy manual via SSH na VPS (`beldofrango-vps`, `/var/www/white-restaurante`).

**Nota sobre verificação:** este projeto não tem framework de testes automatizados (sem jest/mocha, `backend/package.json` não declara nenhum). Toda a verificação no projeto até hoje é manual: `curl` pro backend, `psql` pro banco, e teste visual no navegador. Os passos de "verificar" abaixo seguem esse mesmo padrão — comandos exatos com saída esperada, no lugar de testes automatizados.

Spec de referência: `docs/superpowers/specs/2026-08-04-troco-e-caixa-entregador-design.md`

---

### Task 1: Schema — `valorTrocoPara` em Pedido, `saldoZeradoEm` em Entregador

**Files:**
- Modify: `backend/prisma/schema.prisma`

- [ ] **Step 1: Adicionar os dois campos no schema**

Abra `backend/prisma/schema.prisma`, ache o `model Pedido` (tem o campo `endereco Json?` por volta da linha 351) e adicione `valorTrocoPara` logo depois:

```prisma
  endereco             Json?
  valorTrocoPara       Float?
```

Ache o `model Entregador` (por volta da linha 600) e adicione `saldoZeradoEm` depois de `senhaAlteradaEm`:

```prisma
  senhaAlteradaEm DateTime?
  saldoZeradoEm   DateTime?
```

- [ ] **Step 2: Gerar a migration em dev**

Run: `cd backend && npx prisma migrate dev --name add_troco_e_saldo_entregador`
Expected: cria uma pasta nova em `backend/prisma/migrations/` com um `migration.sql` contendo dois `ALTER TABLE` (`Pedido` ganha `valorTrocoPara`, `Entregador` ganha `saldoZeradoEm`), e termina com `Your database is now in sync with your schema.`

- [ ] **Step 3: Rodar `prisma generate`**

Run: `cd backend && npx prisma generate`
Expected: `✔ Generated Prisma Client`

- [ ] **Step 4: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations
git commit -m "feat: adiciona valorTrocoPara (Pedido) e saldoZeradoEm (Entregador)"
```

---

### Task 2: Backend — checkout aceita e grava `valorTrocoPara`

**Files:**
- Modify: `backend/src/controllers/pedidoController.js:150-256`

- [ ] **Step 1: Ler `valorTrocoPara` do body e validar**

Em `criarPedidoInterno`, logo depois do bloco de validação de `LIMITES_ENDERECO` (depois do `for` que termina na linha ~155, antes do `if (itens.length > 50)`), adicionar:

```javascript
    let valorTrocoPara = null;
    if (req.body.valorTrocoPara !== undefined && req.body.valorTrocoPara !== null && req.body.valorTrocoPara !== '') {
      if (tipo !== 'ENTREGA' || formaPagamento !== 'DINHEIRO') {
        return res.status(400).json({ erro: 'Troco só se aplica a pedidos de entrega pagos em Dinheiro' });
      }
      const v = Number(req.body.valorTrocoPara);
      if (!Number.isFinite(v) || v <= 0) {
        return res.status(400).json({ erro: 'Valor de troco inválido' });
      }
      valorTrocoPara = v;
    }
```

- [ ] **Step 2: Validar contra o total (depois de calcular `total`)**

Logo depois da linha `const total = Math.max(0, Number((subtotal - desconto + taxaEntrega).toFixed(2)));` (linha ~222), adicionar:

```javascript
    if (valorTrocoPara !== null && valorTrocoPara < total) {
      return res.status(400).json({ erro: 'Valor de troco não pode ser menor que o total do pedido' });
    }
```

- [ ] **Step 3: Gravar no create do pedido**

No objeto `data` de `req.prisma.pedido.create` (linha ~241-254), adicionar o campo depois de `formaPagamento,`:

```javascript
        formaPagamento,
        valorTrocoPara,
        itens: { create: itensComTenant },
```

- [ ] **Step 4: Verificar manualmente**

Rodar o backend local (`cd backend && npm run dev`) e criar um pedido de teste via curl (ajuste `produtoId` pra um id real do seu banco de dev):

```bash
curl -s -X POST http://localhost:3010/api/pedidos \
  -H "Content-Type: application/json" \
  -d '{"nomeCliente":"Teste Troco","telefone":"11999999999","tipo":"ENTREGA","endereco":{"rua":"Rua Teste","numero":"1","bairro":"Centro","cidade":"Teste"},"itens":[{"produtoId":1,"quantidade":1}],"formaPagamento":"DINHEIRO","valorTrocoPara":50}'
```

Expected: resposta 201 com o pedido criado. Confirmar no banco:
```bash
cd backend && npx prisma studio
```
ou via `psql`, que o pedido criado tem `valorTrocoPara = 50`.

Testar também o caso de erro — `valorTrocoPara` menor que o total deve dar 400 com `{"erro":"Valor de troco não pode ser menor que o total do pedido"}`.

- [ ] **Step 5: Commit**

```bash
git add backend/src/controllers/pedidoController.js
git commit -m "feat: checkout aceita e valida valorTrocoPara"
```

---

### Task 3: Backend — rota do entregador ver troco e saldo próprio

**Files:**
- Modify: `backend/src/controllers/entregadorController.js`
- Modify: `backend/src/routes/entregador.js`

- [ ] **Step 1: Incluir `valorTrocoPara` na resposta de `meusPedidos`**

Em `backend/src/controllers/entregadorController.js`, na função `meusPedidos` (linha ~86-99), adicionar o campo no `.map`:

```javascript
    res.json(
      pedidos.map((p) => ({
        id: p.id,
        nomeCliente: p.nomeCliente,
        telefone: p.telefone,
        endereco: p.endereco,
        valorTrocoPara: p.valorTrocoPara,
        itens: p.itens.map((it) => ({
```

- [ ] **Step 2: Criar a função `meuSaldo`**

No mesmo arquivo, adicionar antes de `module.exports`:

```javascript
/**
 * Soma dos pedidos pagos em Dinheiro e já ENTREGUES pelo entregador autenticado,
 * desde o último "zerar saldo" do admin (ou desde sempre, se nunca zerou). Não é
 * uma coluna — sempre calculado na hora, pra nunca dessincronizar do estado real
 * dos pedidos.
 */
async function meuSaldo(req, res) {
  try {
    const entregador = await req.prisma.entregador.findFirst({ where: { id: req.entregador.id } });
    const resultado = await req.prisma.pedido.aggregate({
      where: {
        entregadorId: req.entregador.id,
        formaPagamento: 'DINHEIRO',
        statusEntrega: 'ENTREGUE',
        createdAt: { gt: entregador.saldoZeradoEm || entregador.createdAt },
      },
      _sum: { total: true },
    });
    res.json({ saldo: resultado._sum.total || 0 });
  } catch (err) {
    console.error('Erro ao calcular saldo do entregador:', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}
```

- [ ] **Step 3: Exportar `meuSaldo`**

No final do arquivo, atualizar o `module.exports`:

```javascript
module.exports = { listarAdmin, criar, atualizar, meusPedidos, meuSaldo };
```

- [ ] **Step 4: Montar a rota**

Em `backend/src/routes/entregador.js`, adicionar depois de `router.get('/pedidos', entregadorController.meusPedidos);`:

```javascript
router.get('/saldo', entregadorController.meuSaldo);
```

- [ ] **Step 5: Verificar manualmente**

Com um entregador de teste logado (cookie de sessão salvo, ex: via `curl -c cookies.txt -X POST http://localhost:3010/api/entregador/login -H "Content-Type: application/json" -d '{"email":"...","senha":"..."}'`):

```bash
curl -s -b cookies.txt http://localhost:3010/api/entregador/saldo
```

Expected: `{"saldo": 0}` se não tiver pedido Dinheiro entregue ainda, ou a soma correta se tiver. Marcar um pedido Dinheiro como `ENTREGUE` (via admin ou direto no banco) e conferir que o saldo sobe no valor do `total` desse pedido.

- [ ] **Step 6: Commit**

```bash
git add backend/src/controllers/entregadorController.js backend/src/routes/entregador.js
git commit -m "feat: rota GET /entregador/saldo + valorTrocoPara em meusPedidos"
```

---

### Task 4: Backend — admin lista saldos e zera

**Files:**
- Modify: `backend/src/controllers/entregadorController.js`
- Modify: `backend/src/routes/admin.js`

- [ ] **Step 1: Criar `listarSaldos`**

Em `backend/src/controllers/entregadorController.js`, adicionar (pode ficar logo depois de `meuSaldo`):

```javascript
/** Lista todos os entregadores do tenant com o saldo atual de cada um — painel admin. */
async function listarSaldos(req, res) {
  try {
    const entregadores = await req.prisma.entregador.findMany({ orderBy: { nome: 'asc' } });
    const saldos = await Promise.all(
      entregadores.map(async (e) => {
        const resultado = await req.prisma.pedido.aggregate({
          where: {
            entregadorId: e.id,
            formaPagamento: 'DINHEIRO',
            statusEntrega: 'ENTREGUE',
            createdAt: { gt: e.saldoZeradoEm || e.createdAt },
          },
          _sum: { total: true },
        });
        return { id: e.id, nome: e.nome, ativo: e.ativo, saldo: resultado._sum.total || 0 };
      }),
    );
    res.json(saldos);
  } catch (err) {
    console.error('Erro ao listar saldos dos entregadores:', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

/** Zera o saldo de um entregador — painel admin. Não apaga nada, só marca a partir de quando contar de novo. */
async function zerarSaldo(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    await req.prisma.entregador.update({ where: { id }, data: { saldoZeradoEm: new Date() } });
    res.json({ ok: true });
  } catch (err) {
    console.error('Erro ao zerar saldo do entregador:', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}
```

- [ ] **Step 2: Exportar as duas funções**

```javascript
module.exports = { listarAdmin, criar, atualizar, meusPedidos, meuSaldo, listarSaldos, zerarSaldo };
```

- [ ] **Step 3: Montar as rotas admin**

Em `backend/src/routes/admin.js`, adicionar logo depois de `router.put('/entregadores/:id', entregadorController.atualizar);` (linha ~95):

```javascript
router.get('/entregadores/saldos', entregadorController.listarSaldos);
router.post('/entregadores/:id/zerar-saldo', entregadorController.zerarSaldo);
```

- [ ] **Step 4: Verificar manualmente**

Com sessão de admin autenticada (cookie salvo em `admin_cookies.txt`):

```bash
curl -s -b admin_cookies.txt http://localhost:3010/api/admin/entregadores/saldos
```
Expected: array com `[{ id, nome, ativo, saldo }]` pra cada entregador do tenant.

```bash
curl -s -X POST -b admin_cookies.txt http://localhost:3010/api/admin/entregadores/1/zerar-saldo
```
Expected: `{"ok":true}`. Rodar o `GET /saldos` de novo e confirmar que o saldo desse entregador voltou a 0.

- [ ] **Step 5: Commit**

```bash
git add backend/src/controllers/entregadorController.js backend/src/routes/admin.js
git commit -m "feat: rotas admin GET /entregadores/saldos e POST /entregadores/:id/zerar-saldo"
```

---

### Task 5: Frontend — checkout envia `valorTrocoPara`

**Files:**
- Modify: `index.html:1349-1356`

- [ ] **Step 1: Incluir o campo no payload**

Localizar o objeto `payload` dentro da função de finalizar pedido (por volta da linha 1349):

```javascript
    const payload = {
      nomeCliente: usuario.nome,
      telefone: usuario.telefone,
      tipo: s.pedidoTipo === 'retirada' ? 'RETIRADA' : 'ENTREGA',
      endereco: s.pedidoTipo === 'retirada' ? null : usuario.endereco,
      itens,
      formaPagamento: s.payment === 'pix' ? 'PIX' : s.payment === 'money' ? 'DINHEIRO' : 'CARTAO',
    };
```

Adicionar logo depois (antes do `if (s.couponApplied...)`):

```javascript
    if (s.payment === 'money' && s.pedidoTipo !== 'retirada') {
      const valorRecebidoNum = parseFloat(String(s.valorRecebido).replace(',', '.'));
      if (valorRecebidoNum > 0) payload.valorTrocoPara = valorRecebidoNum;
    }
```

- [ ] **Step 2: Validar sintaxe**

Este arquivo embrulha o JS num `<script type="text/x-dc">` que o navegador não executa direto — pra checar sintaxe, extraia o bloco e rode `node --check`:

```bash
node -e "
const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');
const m = html.match(/<script type=\"text\/x-dc\"[^>]*>([\s\S]*?)<\/script>/);
fs.writeFileSync('_check.js', m[1]);
"
node --check _check.js && echo "SINTAXE OK"
rm _check.js
```
Expected: `SINTAXE OK`

- [ ] **Step 3: Verificar manualmente no navegador (dev local)**

Com o backend e o front rodando localmente (`npm run start` na raiz), fazer um pedido de teste escolhendo Dinheiro, preenchendo "Precisa de troco pra quanto?" com um valor, e finalizando. Abrir a aba Network do DevTools, achar o `POST /api/pedidos`, e confirmar no payload que `valorTrocoPara` foi enviado com o valor digitado.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat: checkout envia valorTrocoPara quando paga em Dinheiro"
```

---

### Task 6: Frontend — `entregador.html` mostra troco e saldo

**Files:**
- Modify: `entregador.html`

- [ ] **Step 1: Adicionar `valorTrocoPara` e o troco calculado no card**

Em `renderVals()` (por volta da linha 285-295), no `.map` de `cards`, adicionar campos depois de `pgtoLabel`:

```javascript
    const cards = (s.pedidos || []).map(p => ({
      idLabel: '#' + String(p.id).padStart(4, '0'),
      nomeCliente: p.nomeCliente,
      enderecoFmt: this.enderecoFmt(p.endereco),
      itens: (p.itens || []).map(it => ({ label: it.quantidade + '× ' + (it.nome || '—') })),
      totalFmt: this.fmt(p.total),
      pgtoLabel: p.formaPagamento === 'PIX' ? 'Pix ✓' : p.formaPagamento === 'DINHEIRO' ? 'Dinheiro' : 'Cartão ✓',
      hasTroco: p.formaPagamento === 'DINHEIRO' && p.valorTrocoPara > 0,
      trocoParaFmt: this.fmt(p.valorTrocoPara),
      trocoDarFmt: this.fmt((p.valorTrocoPara || 0) - p.total),
      mapsUrl: this.enderecoParaMaps(p.endereco),
    }));
```

- [ ] **Step 2: Mostrar o troco no template do card**

No arquivo `entregador.html`, achar o bloco do `pgtoLabel` (por volta da linha 105-108):

```html
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
        <span style="font-family:'DM Mono',monospace;font-weight:500;font-size:16px;color:#D62828;">{{ card.totalFmt }}</span>
        <span style="font-size:13px;font-weight:700;color:#6B2E12;">{{ card.pgtoLabel }}</span>
      </div>
```

Adicionar logo depois desse bloco (antes do link "Abrir no Mapa" — o link fica como está):

```html
      <sc-if value="{{ card.hasTroco }}" hint-placeholder-val="{{ false }}">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;background:#FFF3DC;border:1px solid #F2C078;border-radius:10px;padding:8px 12px;">
        <span style="font-size:12.5px;font-weight:700;color:#B45309;">Troco pra {{ card.trocoParaFmt }}</span>
        <span style="font-size:12.5px;font-weight:700;color:#B45309;">Dar {{ card.trocoDarFmt }}</span>
      </div>
      </sc-if>
```

- [ ] **Step 3: Buscar e mostrar o saldo no topo da tela**

Em `entregador.html:165-172`, o `state` inicial declara `pedidos: []`. Adicionar `saldo: 0` logo depois:

```javascript
  state = {
    screen: 'loading', // loading | login | pedidos | senha
    entregador: null,
    loginForm: { email:'', senha:'' }, loginErro:'', loggingIn:false,
    pedidos: [],
    saldo: 0,
    pwd: { atual:'', nova:'', conf:'' }, pwdMsg:'', pwdOk:false,
    mostrarSenha: {},
  };
```

Em `entregador.html:240-243`, `carregarPedidos()` é a única função que busca `/entregador/pedidos`, chamada tanto em `componentDidMount` (linha 224) quanto em `doLogin` (linha 254) — buscar o saldo junto ali cobre os dois pontos de uma vez só:

```javascript
  async carregarPedidos(){
    const [pedidos, { saldo }] = await Promise.all([
      this.apiGet('/entregador/pedidos'),
      this.apiGet('/entregador/saldo'),
    ]);
    this.setState({ pedidos, saldo });
  }
```

No template, achar o cabeçalho da lista de pedidos (procurar por `{{ card.idLabel }}` — cabeçalho fica acima do `sc-for` dos cards) e adicionar acima da lista:

```html
<div style="background:#7A1209;color:#FFF3DC;border-radius:14px;padding:12px 16px;margin-bottom:14px;display:flex;align-items:center;justify-content:space-between;">
  <span style="font-size:13px;font-weight:600;">Você deve devolver</span>
  <span style="font-family:'DM Mono',monospace;font-weight:700;font-size:16px;">{{ saldoFmt }}</span>
</div>
```

E no `renderVals()`, adicionar no objeto de retorno:

```javascript
      saldoFmt: this.fmt(s.saldo),
```

- [ ] **Step 4: Validar sintaxe**

```bash
node -e "
const fs = require('fs');
const html = fs.readFileSync('entregador.html', 'utf8');
const m = html.match(/<script type=\"text\/x-dc\"[^>]*>([\s\S]*?)<\/script>/);
fs.writeFileSync('_check.js', m[1]);
"
node --check _check.js && echo "SINTAXE OK"
rm _check.js
```
Expected: `SINTAXE OK`

- [ ] **Step 5: Verificar manualmente no navegador**

Logar como entregador com pelo menos um pedido Dinheiro (com `valorTrocoPara`) atribuído e em rota. Confirmar: card mostra "Troco pra RX (Dar RY)"; topo da tela mostra "Você deve devolver: R$Z"; marcar o pedido como entregue (via admin) e recarregar a tela do entregador — saldo deve subir no valor do pedido.

- [ ] **Step 6: Commit**

```bash
git add entregador.html
git commit -m "feat: entregador.html mostra troco do pedido e saldo a devolver"
```

---

### Task 7: Frontend — Admin, aba "Caixa dos Entregadores"

**Files:**
- Modify: `Bel do Frango - Admin.dc.html`

- [ ] **Step 1: Adicionar o item no menu lateral**

Achar o botão "Entregadores" no sidebar (linha ~138-141):

```html
      <button data-feature="entregador" onClick="{{ goEntregadores }}" style="{{ navEntregadores }}">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 0 0-16 0"/><circle cx="18" cy="6" r="3" fill="currentColor"/></svg>
        <span style="flex:1;text-align:left;">Entregadores</span>
      </button>
```

Adicionar logo depois:

```html
      <button data-feature="entregador" onClick="{{ goCaixaEntregadores }}" style="{{ navCaixaEntregadores }}">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.2"/><path d="M6 12h.01"/><path d="M18 12h.01"/></svg>
        <span style="flex:1;text-align:left;">Caixa dos Entregadores</span>
      </button>
```

- [ ] **Step 2: Adicionar a seção de conteúdo**

A seção `<!-- ---------- ENTREGADORES ---------- -->` termina em `Bel do Frango - Admin.dc.html:773` com o `</sc-if>` que fecha `isEntregadores`. Adicionar a nova seção logo depois dessa linha:

```html
      <!-- ---------- CAIXA DOS ENTREGADORES ---------- -->
      <sc-if value="{{ isCaixaEntregadores }}" hint-placeholder-val="{{ false }}">
      <div style="animation:adIn .25s ease-out;">
        <div style="background:#FFFBF3;border:1px solid rgba(29,16,9,.07);border-radius:18px;overflow:hidden;box-shadow:0 5px 16px rgba(29,16,9,.05);">
          <div style="display:grid;grid-template-columns:2fr 1fr 120px;gap:14px;padding:13px 20px;background:#F6F1E7;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#8C8075;">
            <span>Nome</span><span>Saldo</span><span></span>
          </div>
          <sc-for list="{{ caixaEntregadorRows }}" as="ce" hint-placeholder-count="3">
            <div style="display:grid;grid-template-columns:2fr 1fr 120px;gap:14px;padding:15px 20px;border-top:1px solid rgba(29,16,9,.06);align-items:center;">
              <div style="font-weight:700;font-size:14px;">{{ ce.nome }}</div>
              <div style="font-family:'DM Mono',monospace;font-weight:700;font-size:15px;color:#D97706;">{{ ce.saldoFmt }}</div>
              <div style="display:flex;justify-content:flex-end;"><button onClick="{{ ce.onZerar }}" style="background:#FFF3DC;color:#B45309;border:1px solid #F2C078;border-radius:9px;padding:8px 14px;font-weight:700;font-size:12.5px;cursor:pointer;">Zerar</button></div>
            </div>
          </sc-for>
          <sc-if value="{{ caixaEntregadoresEmpty }}" hint-placeholder-val="{{ false }}"><div style="padding:46px;text-align:center;color:#8C8075;">Nenhum entregador cadastrado.</div></sc-if>
        </div>
      </div>
      </sc-if>
```

- [ ] **Step 3: Adicionar ao `titles`**

Achar o objeto `titles` (linha ~3125-3139) e adicionar uma entrada:

```javascript
      entregadores:['Entregadores','Cadastre e gerencie os entregadores do delivery'],
      caixaentregadores:['Caixa dos Entregadores','Quanto cada entregador tem em mãos pra devolver'],
```

- [ ] **Step 4: Adicionar estado, load e mapeamento**

No `state` inicial (perto de `entregadores:[]`), adicionar:

```javascript
    caixaEntregadores:[],
```

Adicionar um método de carregamento (perto de `carregarEntregadores`):

```javascript
  async carregarCaixaEntregadores(){
    const lista = await this.apiGet('/admin/entregadores/saldos');
    this.setState({ caixaEntregadores: lista });
  }
  async zerarSaldoEntregador(id){
    if (!confirm('Zerar o saldo desse entregador? Essa ação não pode ser desfeita.')) return;
    try {
      await this.apiSend('POST', '/admin/entregadores/' + id + '/zerar-saldo', {});
      await this.carregarCaixaEntregadores();
      this.showToast('Saldo zerado');
    } catch (e) { this.showToast(e.message || 'Erro ao zerar saldo'); }
  }
```

Chamar `this.carregarCaixaEntregadores()` só quando a aba for aberta (não precisa entrar no `Promise.all` de `carregarTudo` — dado que só é consultado quando o admin abre essa aba especificamente). Achar `goEntregadores:() => this.nav('entregadores')` (linha ~3515) e adicionar ao lado:

```javascript
      goEntregadores:() => this.nav('entregadores'), goCaixaEntregadores:() => { this.nav('caixaentregadores'); this.carregarCaixaEntregadores(); },
```

- [ ] **Step 5: Adicionar nav style, `isCaixaEntregadores` e `caixaEntregadorRows`**

Achar `navEntregadores:navStyle(s.view==='entregadores')` (linha ~3518) e adicionar ao lado:

```javascript
      navEntregadores:navStyle(s.view==='entregadores'), navCaixaEntregadores:navStyle(s.view==='caixaentregadores'),
```

Achar `isEntregadores: s.view==='entregadores'` (linha ~3529) e adicionar ao lado:

```javascript
      isEntregadores: s.view==='entregadores', isCaixaEntregadores: s.view==='caixaentregadores',
```

Achar `entregadorRows: s.entregadores.map(...)` (linha ~3546-3553) e adicionar logo depois:

```javascript
      caixaEntregadoresEmpty: s.caixaEntregadores.length === 0,
      caixaEntregadorRows: s.caixaEntregadores.map(ce => ({
        nome: ce.nome,
        saldoFmt: this.fmt(ce.saldo),
        onZerar:() => this.zerarSaldoEntregador(ce.id)
      })),
```

- [ ] **Step 6: Validar sintaxe**

```bash
node -e "
const fs = require('fs');
const html = fs.readFileSync('Bel do Frango - Admin.dc.html', 'utf8');
const m = html.match(/<script type=\"text\/x-dc\"[^>]*>([\s\S]*?)<\/script>/);
fs.writeFileSync('_check.js', m[1]);
"
node --check _check.js && echo "SINTAXE OK"
rm _check.js
```
Expected: `SINTAXE OK`

- [ ] **Step 7: Verificar manualmente no navegador**

Logar como admin, abrir "Caixa dos Entregadores" no menu lateral. Confirmar: lista todos os entregadores com saldo correto (bate com o que a tela do entregador mostra); clicar "Zerar" pede confirmação, zera, e o saldo volta a 0 na lista.

- [ ] **Step 8: Commit**

```bash
git add "Bel do Frango - Admin.dc.html"
git commit -m "feat: aba Caixa dos Entregadores no Admin"
```

---

### Task 8: Deploy em produção

**Files:** nenhum (só operação de deploy)

- [ ] **Step 1: Abrir PR e mergear**

```bash
git push -u origin <nome-da-branch>
gh pr create --repo NETOLUIZ/white-restaurante --base main --head <nome-da-branch> --title "feat: troco visível + saldo de caixa por entregador" --body "Implementa a spec docs/superpowers/specs/2026-08-04-troco-e-caixa-entregador-design.md"
gh pr merge <numero> --repo NETOLUIZ/white-restaurante --merge --delete-branch=false
```

- [ ] **Step 2: Confirmar o merge**

```bash
git fetch origin main && git log origin/main --oneline -3
```
Expected: o commit de merge aparece no topo.

- [ ] **Step 3: Rodar a migration em produção — SÓ com confirmação explícita do usuário antes de rodar**

```bash
ssh beldofrango-vps "cd /var/www/white-restaurante && git pull --ff-only origin main"
ssh beldofrango-vps "cd /var/www/white-restaurante && docker compose exec -T backend npx prisma migrate deploy"
```
Expected: `X migrations found... Applying migration ... All migrations have been successfully applied.`

- [ ] **Step 4: Rebuild do backend (mudou controller/rotas)**

```bash
ssh beldofrango-vps "cd /var/www/white-restaurante && docker compose build backend && docker compose up -d --no-deps backend"
```
Expected: `Container white-restaurante-backend-1 Started`. Conferir log: `ssh beldofrango-vps "docker logs white-restaurante-backend-1 --tail 5"` deve mostrar `🍗 Bel do Frango ATU API rodando na porta 3010` sem erro.

- [ ] **Step 5: Recriar nginx (mudaram arquivos HTML individuais montados)**

```bash
ssh beldofrango-vps "cd /var/www/white-restaurante && docker compose up -d --force-recreate --no-deps nginx"
```

- [ ] **Step 6: Verificação final em produção**

```bash
ssh beldofrango-vps "curl -s -o /dev/null -w 'HTTP %{http_code}\n' -H 'Host: tocomfome.korentech.com.br' http://127.0.0.1:3020/"
ssh beldofrango-vps "curl -s -o /dev/null -w 'HTTP %{http_code}\n' -H 'Host: tocomfome.korentech.com.br' http://127.0.0.1:3020/entregador"
```
Expected: `HTTP 200` nos dois. Testar o fluxo completo com um tenant real: pedido Dinheiro com troco → aparece no card do entregador → marcar entregue → saldo sobe (tela do entregador e aba nova do Admin) → zerar no Admin → saldo volta a 0.

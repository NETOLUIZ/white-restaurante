# Evolução do Painel de Personalização Visual — Fase 1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrar `index.html` para CSS custom properties (eliminando a heurística de RGB do `scripts/tema.js` para essa tela), adicionar live preview via iframe, e expandir o painel de marca (`super.html`) com os grupos Cores Base, Botões, Cards e Blocos, e Navegação.

**Architecture:** `TenantBranding` ganha colunas novas (Prisma). `scripts/tema.js` passa a injetar as cores como `:root{--x:...}` além do que já faz hoje, e ganha um listener de `postMessage` para preview ao vivo. `index.html` tem seus estilos hardcoded trocados por `var(--token, valor-atual)` nos pontos relevantes. `super.html` reorganiza a aba MARCA em sub-abas e ganha um iframe de preview.

**Tech Stack:** Node.js + Express + Prisma (backend), HTML + runtime proprietário "DC" via `scripts/support.js` (frontend, sem framework/bundler).

**Spec de referência:** `docs/superpowers/specs/2026-08-04-painel-personalizacao-fase1-design.md`

---

## Mapeamento de campos — fonte de verdade

Esta tabela é a referência usada em todas as tasks abaixo. `(sem aplicação nesta fase)` = o campo existe no banco e no painel, mas nenhum elemento do `index.html` é ligado a ele ainda (decisão já validada com o usuário: não existe elemento real hoje pra esses casos).

| Campo Prisma | CSS var | Valor atual (fallback) | Onde se aplica em `index.html` |
|---|---|---|---|
| `corFundo` | `--cor-fundo` | `#FFF6D6` | Sweep geral (todas ocorrências) |
| `corFundoSecundaria` (novo) | `--cor-fundo-secundaria` | `#FFF3DC` | Sweep geral |
| `corPrimaria` | `--cor-primaria` | `#B5161C` | Sweep geral (exceto overrides abaixo) |
| `corSecundaria` | `--cor-secundaria` | `#F2B705` | Sweep geral (exceto overrides abaixo) |
| `corTexto` | `--cor-texto` | `#1D1009` | Sweep geral (só valores sólidos, não `rgba()`) |
| `corDestaque`/`corSucesso`/`corAlerta`/`corErro` (novos) | — | — | (sem aplicação nesta fase) |
| `botaoPrimarioFundo` (renomeado de `corBotao`) | `--botao-primario-fundo` | `#D62828` | Sweep geral (exceto overrides de borda) |
| `botaoPrimarioTexto` (renomeado de `corTextoBotao`) | `--botao-primario-texto` | `#FFFFFF` | Pontos enumerados (Task 12) |
| `botaoPrimarioBorda` (novo) | `--botao-primario-borda` | `#D62828` | Pontos enumerados (Task 13) |
| `botaoSecundarioFundo/Texto/Borda`, `botaoDesabilitadoFundo/Texto` (novos) | — | — | (sem aplicação nesta fase) |
| `corCard` | `--cor-card` | `#FFFFFF` | Pontos enumerados (Task 11) |
| `cardCorBorda` (novo) | `--card-cor-borda` | `rgba(29,16,9,.06)` | Pontos enumerados (Task 11) |
| `cardCorTitulo` (novo) | `--card-cor-titulo` | `#B5161C` | 1 ponto (Task 11) |
| `cardCorTextoSecundario` (novo) | `--card-cor-texto-secundario` | `#7A6C5D` | 2 pontos (Task 11) |
| `cardCorHover` (novo) | — | — | (sem aplicação nesta fase — não existe hover de cor hoje) |
| `cardRaioBorda` (novo) | `--card-raio-borda` | `8px` | Card de produto só (Task 11) |
| `headerFundo` (novo) | `--header-fundo` | `#F2B705` | Task 10 |
| `headerCorSaudacao` (novo) | `--header-cor-saudacao` | `#8A1C12` | Task 10 |
| `headerCorIconeUsuario` (novo) | `--header-cor-icone-usuario` | `#B5161C` | Task 10 |
| `headerCorLocalizacao` (novo) | `--header-cor-localizacao` | `#7A1209` | Task 10 |
| `headerCorNotificacao` (novo) | `--header-cor-notificacao` | `#B5161C` | Task 10 |
| `navInferiorFundo` (novo) | `--nav-inferior-fundo` | `#FFFFFF` | Task 9 |
| `navInferiorIconeNormal`/`Ativo` (novos) | `--nav-inferior-icone-normal/ativo` | `#A89A88` / `#D62828` | Task 9 |
| `navInferiorTextoNormal`/`Ativo` (novos) | `--nav-inferior-texto-normal/ativo` | `#A89A88` / `#D62828` | Task 9 |

**Ordem de execução importa**: as tasks 9, 10 e 11 (pontos enumerados/overrides) rodam **antes** das tasks de sweep geral (14-19), porque convertem linhas específicas para uma var diferente da que o sweep geral usaria. Depois que uma linha já foi convertida, o hex literal não existe mais nela — o sweep geral simplesmente não a encontra de novo.

**Fora do escopo desta fase, documentado**: todas as ocorrências de `rgba(214,40,40,X)` e `rgba(29,16,9,X)` **fora** dos pontos enumerados de card (bordas de input, divisores, sombras de dropdown, overlay de modal) continuam hardcoded — não reagem a mudança de branding nesta fase. `styles/main.css` não é referenciado por nenhum HTML do projeto — ignorado.

---

## PARTE A — Backend

### Task 1: Migration Prisma — renomear e adicionar colunas em `TenantBranding`

**Files:**
- Modify: `backend/prisma/schema.prisma:646-666`
- Create: `backend/prisma/migrations/20260804210000_evoluir_branding_fase1/migration.sql`

- [ ] **Step 1: Editar o model `TenantBranding` no schema**

Em `backend/prisma/schema.prisma`, substituir o bloco (linhas 646-666):

```prisma
model TenantBranding {
  id       Int    @id @default(autoincrement())
  tenantId String @unique
  tenant   Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  logoUrl    String?
  faviconUrl String?

  corPrimaria   String @default("#C8102E")
  corSecundaria String @default("#F5A623")
  corBotao      String @default("#C8102E")
  corTextoBotao String @default("#FFFFFF")
  corFundo      String @default("#FFFFFF")
  corTexto      String @default("#1A1A1A")
  corCard       String @default("#FFFFFF")

  fonteTitulo String @default("Inter")
  fonteTexto  String @default("Inter")

  updatedAt DateTime @updatedAt
}
```

por:

```prisma
model TenantBranding {
  id       Int    @id @default(autoincrement())
  tenantId String @unique
  tenant   Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  logoUrl    String?
  faviconUrl String?

  // Cores Base
  corPrimaria       String @default("#C8102E")
  corSecundaria     String @default("#F5A623")
  corFundo          String @default("#FFFFFF")
  corFundoSecundaria String @default("#F7F7F7")
  corTexto          String @default("#1A1A1A")
  corDestaque       String @default("#F5A623")
  corSucesso        String @default("#16A34A")
  corAlerta         String @default("#F59E0B")
  corErro           String @default("#DC2626")

  // Botões
  botaoPrimarioFundo     String @default("#C8102E")
  botaoPrimarioTexto     String @default("#FFFFFF")
  botaoPrimarioBorda     String @default("#C8102E")
  botaoSecundarioFundo   String @default("#FFFFFF")
  botaoSecundarioTexto   String @default("#C8102E")
  botaoSecundarioBorda   String @default("#C8102E")
  botaoDesabilitadoFundo String @default("#E5E5E5")
  botaoDesabilitadoTexto String @default("#9CA3AF")

  // Cards e Blocos
  corCard                String @default("#FFFFFF")
  cardCorBorda           String @default("#E5E5E5")
  cardCorTitulo          String @default("#1A1A1A")
  cardCorTextoSecundario String @default("#6B7280")
  cardCorHover           String @default("#F5F5F5")
  cardRaioBorda          String @default("8px")

  // Navegação — Cabeçalho
  headerFundo          String @default("#FFFFFF")
  headerCorSaudacao    String @default("#1A1A1A")
  headerCorIconeUsuario String @default("#1A1A1A")
  headerCorLocalizacao String @default("#6B7280")
  headerCorNotificacao String @default("#C8102E")

  // Navegação — Barra inferior
  navInferiorFundo       String @default("#FFFFFF")
  navInferiorIconeNormal String @default("#9CA3AF")
  navInferiorIconeAtivo  String @default("#C8102E")
  navInferiorTextoNormal String @default("#9CA3AF")
  navInferiorTextoAtivo  String @default("#C8102E")

  fonteTitulo String @default("Inter")
  fonteTexto  String @default("Inter")

  updatedAt DateTime @updatedAt
}
```

Os valores `@default` acima são os defaults genéricos do produto (mesma família de cores dos campos já existentes) — servem só pra tenants novos. A migration do Step 2 usa valores diferentes (extraídos do `index.html` real) como default de banco pros tenants **já existentes**, pra não mudar a aparência deles.

- [ ] **Step 2: Escrever a migration SQL manualmente (preserva dados via RENAME, não DROP+CREATE)**

Rodar:
```bash
cd backend && mkdir -p prisma/migrations/20260804210000_evoluir_branding_fase1
```

Criar `backend/prisma/migrations/20260804210000_evoluir_branding_fase1/migration.sql`:

```sql
-- Renomeia colunas existentes (preserva os valores já salvos por tenant)
ALTER TABLE "TenantBranding" RENAME COLUMN "corBotao" TO "botaoPrimarioFundo";
ALTER TABLE "TenantBranding" RENAME COLUMN "corTextoBotao" TO "botaoPrimarioTexto";

-- Colunas novas — default = aparência atual do template (não o default genérico
-- do schema.prisma, que só vale pra tenant novo) para não mudar visual de tenant existente.
ALTER TABLE "TenantBranding" ADD COLUMN "corFundoSecundaria" TEXT NOT NULL DEFAULT '#FFF3DC';
ALTER TABLE "TenantBranding" ADD COLUMN "corDestaque" TEXT NOT NULL DEFAULT '#F2B705';
ALTER TABLE "TenantBranding" ADD COLUMN "corSucesso" TEXT NOT NULL DEFAULT '#2D9E60';
ALTER TABLE "TenantBranding" ADD COLUMN "corAlerta" TEXT NOT NULL DEFAULT '#B45309';
ALTER TABLE "TenantBranding" ADD COLUMN "corErro" TEXT NOT NULL DEFAULT '#C0392B';

ALTER TABLE "TenantBranding" ADD COLUMN "botaoPrimarioBorda" TEXT NOT NULL DEFAULT '#D62828';
ALTER TABLE "TenantBranding" ADD COLUMN "botaoSecundarioFundo" TEXT NOT NULL DEFAULT '#FFFFFF';
ALTER TABLE "TenantBranding" ADD COLUMN "botaoSecundarioTexto" TEXT NOT NULL DEFAULT '#D62828';
ALTER TABLE "TenantBranding" ADD COLUMN "botaoSecundarioBorda" TEXT NOT NULL DEFAULT '#D62828';
ALTER TABLE "TenantBranding" ADD COLUMN "botaoDesabilitadoFundo" TEXT NOT NULL DEFAULT '#E5E5E5';
ALTER TABLE "TenantBranding" ADD COLUMN "botaoDesabilitadoTexto" TEXT NOT NULL DEFAULT '#9CA3AF';

ALTER TABLE "TenantBranding" ADD COLUMN "cardCorBorda" TEXT NOT NULL DEFAULT '#E5DACB';
ALTER TABLE "TenantBranding" ADD COLUMN "cardCorTitulo" TEXT NOT NULL DEFAULT '#B5161C';
ALTER TABLE "TenantBranding" ADD COLUMN "cardCorTextoSecundario" TEXT NOT NULL DEFAULT '#7A6C5D';
ALTER TABLE "TenantBranding" ADD COLUMN "cardCorHover" TEXT NOT NULL DEFAULT '#F5F5F5';
ALTER TABLE "TenantBranding" ADD COLUMN "cardRaioBorda" TEXT NOT NULL DEFAULT '8px';

ALTER TABLE "TenantBranding" ADD COLUMN "headerFundo" TEXT NOT NULL DEFAULT '#F2B705';
ALTER TABLE "TenantBranding" ADD COLUMN "headerCorSaudacao" TEXT NOT NULL DEFAULT '#8A1C12';
ALTER TABLE "TenantBranding" ADD COLUMN "headerCorIconeUsuario" TEXT NOT NULL DEFAULT '#B5161C';
ALTER TABLE "TenantBranding" ADD COLUMN "headerCorLocalizacao" TEXT NOT NULL DEFAULT '#7A1209';
ALTER TABLE "TenantBranding" ADD COLUMN "headerCorNotificacao" TEXT NOT NULL DEFAULT '#B5161C';

ALTER TABLE "TenantBranding" ADD COLUMN "navInferiorFundo" TEXT NOT NULL DEFAULT '#FFFFFF';
ALTER TABLE "TenantBranding" ADD COLUMN "navInferiorIconeNormal" TEXT NOT NULL DEFAULT '#A89A88';
ALTER TABLE "TenantBranding" ADD COLUMN "navInferiorIconeAtivo" TEXT NOT NULL DEFAULT '#D62828';
ALTER TABLE "TenantBranding" ADD COLUMN "navInferiorTextoNormal" TEXT NOT NULL DEFAULT '#A89A88';
ALTER TABLE "TenantBranding" ADD COLUMN "navInferiorTextoAtivo" TEXT NOT NULL DEFAULT '#D62828';
```

- [ ] **Step 3: Aplicar em dev e gerar o client**

```bash
cd backend && npx prisma migrate dev
```
Quando o Prisma CLI perguntar sobre a migration (ele detecta que já existe a pasta), escolher aplicar a migration existente sem gerar outra. Se ele tentar gerar uma migration *diferente* da que foi escrita à mão (sinal de drift), parar e conferir se o schema.prisma bate exatamente com o SQL acima antes de continuar.

Rodar em seguida: `npx prisma generate`.

- [ ] **Step 4: Verificar que dados de tenants existentes foram preservados**

```bash
cd backend && npx prisma studio
```
Abrir a tabela `TenantBranding` e conferir: (a) a coluna `botaoPrimarioFundo` tem o valor que antes estava em `corBotao` pra cada tenant já cadastrado; (b) `botaoPrimarioTexto` idem pra `corTextoBotao`; (c) as colunas novas existem com os defaults do Step 2.

- [ ] **Step 5: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations/20260804210000_evoluir_branding_fase1
git commit -m "$(cat <<'EOF'
feat(branding): expande TenantBranding com campos de cores base, botões, cards e navegação

Renomeia corBotao/corTextoBotao para botaoPrimarioFundo/Texto (migration
preserva dados) e adiciona as colunas da Fase 1 do painel de
personalização (ver docs/superpowers/plans/2026-08-04-painel-personalizacao-fase1.md).
EOF
)"
```

---

### Task 2: Backend — expandir validação (`utils/branding.js`)

**Files:**
- Modify: `backend/src/utils/branding.js`

- [ ] **Step 1: Substituir a lista `CAMPOS_COR` e adicionar validação de `cardRaioBorda`**

Em `backend/src/utils/branding.js`, trocar:

```js
const CAMPOS_COR = ['corPrimaria', 'corSecundaria', 'corBotao', 'corTextoBotao', 'corFundo', 'corTexto', 'corCard'];
const CAMPOS_FONTE = ['fonteTitulo', 'fonteTexto'];
```

por:

```js
const CAMPOS_COR = [
  'corPrimaria', 'corSecundaria', 'corFundo', 'corFundoSecundaria', 'corTexto',
  'corDestaque', 'corSucesso', 'corAlerta', 'corErro',
  'botaoPrimarioFundo', 'botaoPrimarioTexto', 'botaoPrimarioBorda',
  'botaoSecundarioFundo', 'botaoSecundarioTexto', 'botaoSecundarioBorda',
  'botaoDesabilitadoFundo', 'botaoDesabilitadoTexto',
  'corCard', 'cardCorBorda', 'cardCorTitulo', 'cardCorTextoSecundario', 'cardCorHover',
  'headerFundo', 'headerCorSaudacao', 'headerCorIconeUsuario', 'headerCorLocalizacao', 'headerCorNotificacao',
  'navInferiorFundo', 'navInferiorIconeNormal', 'navInferiorIconeAtivo', 'navInferiorTextoNormal', 'navInferiorTextoAtivo',
];
const CAMPOS_FONTE = ['fonteTitulo', 'fonteTexto'];
const CAMPO_RAIO = 'cardRaioBorda';
const RAIO_REGEX = /^\d+(\.\d+)?(px|rem)$/;
```

E dentro de `montarDadosBranding`, depois do loop de `CAMPOS_FONTE`, adicionar antes do `return data;`:

```js
  if (body[CAMPO_RAIO] !== undefined) {
    if (!RAIO_REGEX.test(body[CAMPO_RAIO])) {
      throw new ErroValidacaoBranding(`${CAMPO_RAIO} precisa ser um comprimento CSS válido (ex: 8px ou 0.5rem)`);
    }
    data[CAMPO_RAIO] = body[CAMPO_RAIO];
  }
```

- [ ] **Step 2: Teste manual da validação**

```bash
cd backend && node -e "
const { montarDadosBranding, ErroValidacaoBranding } = require('./src/utils/branding');
console.log(montarDadosBranding({ botaoPrimarioFundo: '#123456', cardRaioBorda: '10px' }));
try { montarDadosBranding({ cardRaioBorda: '10' }); console.log('FALHOU: deveria ter lançado erro'); }
catch (e) { console.log(e instanceof ErroValidacaoBranding ? 'OK: rejeitou raio inválido' : 'FALHOU'); }
try { montarDadosBranding({ botaoPrimarioFundo: 'red' }); console.log('FALHOU: deveria ter lançado erro'); }
catch (e) { console.log(e instanceof ErroValidacaoBranding ? 'OK: rejeitou cor inválida' : 'FALHOU'); }
"
```
Esperado: imprime o objeto validado e as duas linhas `OK:`.

- [ ] **Step 3: Commit**

```bash
git add backend/src/utils/branding.js
git commit -m "$(cat <<'EOF'
feat(branding): valida os campos novos de cor e o raio de borda do card

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Backend — expandir cálculo de contraste (`utils/contraste.js`)

**Files:**
- Modify: `backend/src/utils/contraste.js`

- [ ] **Step 1: Trocar `calcularContrasteBranding` para checar os novos pares texto/fundo**

Substituir a função inteira:

```js
function calcularContrasteBranding(branding) {
  const botao = razaoContraste(branding.corBotao, branding.corTextoBotao);
  const texto = razaoContraste(branding.corFundo, branding.corTexto);
  const aviso = [];
  if (botao < LIMIAR_AA_TEXTO_NORMAL) aviso.push('botao');
  if (texto < LIMIAR_AA_TEXTO_NORMAL) aviso.push('texto');
  return { botao, texto, aviso };
}
```

por:

```js
function calcularContrasteBranding(branding) {
  const pares = {
    botao: razaoContraste(branding.botaoPrimarioFundo, branding.botaoPrimarioTexto),
    texto: razaoContraste(branding.corFundo, branding.corTexto),
    botaoSecundario: razaoContraste(branding.botaoSecundarioFundo, branding.botaoSecundarioTexto),
    cardTitulo: razaoContraste(branding.corCard, branding.cardCorTitulo),
    cardTextoSecundario: razaoContraste(branding.corCard, branding.cardCorTextoSecundario),
    header: razaoContraste(branding.headerFundo, branding.headerCorSaudacao),
    navInferiorAtivo: razaoContraste(branding.navInferiorFundo, branding.navInferiorTextoAtivo),
    navInferiorNormal: razaoContraste(branding.navInferiorFundo, branding.navInferiorTextoNormal),
  };
  const aviso = Object.keys(pares).filter((chave) => pares[chave] < LIMIAR_AA_TEXTO_NORMAL);
  return { ...pares, aviso };
}
```

- [ ] **Step 2: Teste manual**

```bash
cd backend && node -e "
const { calcularContrasteBranding } = require('./src/utils/contraste');
const r = calcularContrasteBranding({
  botaoPrimarioFundo:'#D62828', botaoPrimarioTexto:'#FFFFFF',
  corFundo:'#FFFFFF', corTexto:'#1A1A1A',
  botaoSecundarioFundo:'#FFFFFF', botaoSecundarioTexto:'#D62828',
  corCard:'#FFFFFF', cardCorTitulo:'#B5161C', cardCorTextoSecundario:'#7A6C5D',
  headerFundo:'#F2B705', headerCorSaudacao:'#8A1C12',
  navInferiorFundo:'#FFFFFF', navInferiorTextoAtivo:'#D62828', navInferiorTextoNormal:'#EFEFEF',
});
console.log(r);
console.log(r.aviso.includes('navInferiorNormal') ? 'OK: detectou contraste baixo' : 'FALHOU');
"
```
Esperado: objeto com todos os pares numéricos e `aviso` contendo `'navInferiorNormal'` (`#FFFFFF` sobre `#FFFFFF`/quase-branco é baixo contraste de propósito, pra testar a detecção).

- [ ] **Step 3: Commit**

```bash
git add backend/src/utils/contraste.js
git commit -m "$(cat <<'EOF'
feat(branding): estende checagem de contraste pros pares novos (card, header, nav)

Nunca bloqueia o save — mesmo comportamento de antes, só populariza o aviso.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

**Nota:** `superBrandingController.js` e `configPublicoController.js` não precisam de nenhuma mudança — já são genéricos (passam `req.body`/`data` inteiro pro `montarDadosBranding`/`upsert`, sem listar campos fixos).

---

## PARTE B — `scripts/tema.js`

### Task 4: Injetar CSS custom properties no `:root`

**Files:**
- Modify: `scripts/tema.js:88-105` (função `montarCssBase`)

- [ ] **Step 1: Adicionar a lista de campos e a função que gera as variáveis**

Logo abaixo de `var REGRAS_COR = [...]` (depois da linha 54), adicionar:

```js
  // Campos novos da Fase 1 do painel de personalização — cada um vira uma
  // CSS custom property em :root. Elementos migrados em index.html usam
  // var(--nome, fallback); o fallback é o valor original hardcoded, então
  // funciona mesmo antes do fetch de /config terminar.
  var CAMPOS_CSS_VAR = {
    corFundo: '--cor-fundo', corFundoSecundaria: '--cor-fundo-secundaria',
    corPrimaria: '--cor-primaria', corSecundaria: '--cor-secundaria', corTexto: '--cor-texto',
    botaoPrimarioFundo: '--botao-primario-fundo', botaoPrimarioTexto: '--botao-primario-texto', botaoPrimarioBorda: '--botao-primario-borda',
    corCard: '--cor-card', cardCorBorda: '--card-cor-borda', cardCorTitulo: '--card-cor-titulo',
    cardCorTextoSecundario: '--card-cor-texto-secundario', cardRaioBorda: '--card-raio-borda',
    headerFundo: '--header-fundo', headerCorSaudacao: '--header-cor-saudacao', headerCorIconeUsuario: '--header-cor-icone-usuario',
    headerCorLocalizacao: '--header-cor-localizacao', headerCorNotificacao: '--header-cor-notificacao',
    navInferiorFundo: '--nav-inferior-fundo', navInferiorIconeNormal: '--nav-inferior-icone-normal', navInferiorIconeAtivo: '--nav-inferior-icone-ativo',
    navInferiorTextoNormal: '--nav-inferior-texto-normal', navInferiorTextoAtivo: '--nav-inferior-texto-ativo',
  };

  function montarCssVarsRoot(branding) {
    var linhas = [];
    Object.keys(CAMPOS_CSS_VAR).forEach(function (campo) {
      if (branding[campo]) linhas.push(CAMPOS_CSS_VAR[campo] + ':' + branding[campo] + ';');
    });
    return linhas.length ? ':root{' + linhas.join('') + '}' : '';
  }

  /** Usado pelo listener de preview (Task 5) e por aplicarCssBase — aplica as
   * vars direto no documentElement, sem esperar um novo <style>. */
  function aplicarCssVarsDireto(branding) {
    var root = document.documentElement.style;
    Object.keys(CAMPOS_CSS_VAR).forEach(function (campo) {
      if (branding[campo]) root.setProperty(CAMPOS_CSS_VAR[campo], branding[campo]);
    });
  }
```

- [ ] **Step 2: Chamar `montarCssVarsRoot` dentro de `montarCssBase`**

Trocar a função `montarCssBase` (linhas 88-105):

```js
  function montarCssBase(branding, features) {
    var linhas = [];
    linhas.push('body{background:' + (branding.corFundo || '') + ' !important;color:' + (branding.corTexto || '') + ' !important}');
```

por (só adiciona uma linha no início do array, resto idêntico):

```js
  function montarCssBase(branding, features) {
    var linhas = [montarCssVarsRoot(branding)];
    linhas.push('body{background:' + (branding.corFundo || '') + ' !important;color:' + (branding.corTexto || '') + ' !important}');
```

- [ ] **Step 3: Verificação manual**

```bash
cd backend && npm run dev
```
Em outro terminal, `cd .. && node scripts/dev-server.js` (ou o comando de dev-server já usado no projeto). Abrir `http://localhost:5000/index.html?_tenant=belfrango` (ajustar slug pro tenant de dev existente), abrir o DevTools → Elements → `<html>` → conferir que existe `style="--cor-fundo:...; --cor-primaria:...; ..."` ou um `<style id="bf-tema-tenant">` contendo `:root{--cor-fundo:...}` no `<head>`.

- [ ] **Step 4: Commit**

```bash
git add scripts/tema.js
git commit -m "$(cat <<'EOF'
feat(tema): injeta cores do branding como CSS custom properties em :root

Base para migrar index.html a usar var(--x) em vez da heurística de RGB.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Listener de `postMessage` para live preview

**Files:**
- Modify: `scripts/tema.js` (fim do arquivo, dentro da IIFE)

- [ ] **Step 1: Adicionar o listener antes do fechamento da IIFE**

Antes da linha final `})();`, adicionar:

```js
  // Live preview (painel super admin) — só aceita mensagens da origem exata
  // do painel, nunca de qualquer postMessage genérico. Não persiste nada:
  // só troca as CSS vars na hora, pro iframe de preview refletir o form.
  var ORIGENS_PREVIEW_PERMITIDAS = isDevLocal
    ? null // em dev aceita qualquer origem localhost (porta do super.html varia)
    : [location.origin.replace(/^https:\/\//, 'https://super.')];

  function origemPermitida(origem) {
    if (isDevLocal) return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origem);
    return ORIGENS_PREVIEW_PERMITIDAS.indexOf(origem) !== -1;
  }

  window.addEventListener('message', function (event) {
    if (!origemPermitida(event.origin)) return;
    if (!event.data || event.data.type !== 'bf-preview-update' || !event.data.branding) return;
    aplicarCssVarsDireto(event.data.branding);
  });
```

- [ ] **Step 2: Verificação manual (no console do navegador, na aba de `index.html`)**

```js
document.documentElement.style.getPropertyValue('--cor-primaria') // valor atual
window.postMessage({ type: 'bf-preview-update', branding: { corPrimaria: '#00FF00' } }, '*')
document.documentElement.style.getPropertyValue('--cor-primaria') // deve ser '#00FF00' agora
```
(O `postMessage` disparado pelo próprio console tem `event.origin` igual à origem da própria página, que passa no teste `isDevLocal` — é só pra confirmar que o listener e `aplicarCssVarsDireto` funcionam; o teste de origem cruzada de verdade acontece na Task 17.)

- [ ] **Step 3: Commit**

```bash
git add scripts/tema.js
git commit -m "$(cat <<'EOF'
feat(tema): listener de postMessage pra live preview do painel de marca

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## PARTE C — `index.html` — pontos enumerados (overrides), antes do sweep geral

### Task 6: Cabeçalho (Home) — 5 campos novos

**Files:**
- Modify: `index.html:84, 137, 139, 141, 142-146, 148, 150`

- [ ] **Step 1: `headerFundo` — linha 84 (barra superior desktop)**

Trocar:
```html
<div id="bf-top-nav" style="display:flex;align-items:center;gap:18px;padding:16px 26px;background:#F2B705;color:#7A1209;flex:none;">
```
por:
```html
<div id="bf-top-nav" style="display:flex;align-items:center;gap:18px;padding:16px 26px;background:var(--header-fundo, #F2B705);color:#7A1209;flex:none;">
```

- [ ] **Step 2: `headerFundo` — linha 137 (header hero mobile)**

Trocar:
```html
  <div style="background:#F2B705;color:#7A1209;padding:calc(16px + env(safe-area-inset-top)) 18px 22px;border-radius:0 0 26px 26px;">
```
por:
```html
  <div style="background:var(--header-fundo, #F2B705);color:#7A1209;padding:calc(16px + env(safe-area-inset-top)) 18px 22px;border-radius:0 0 26px 26px;">
```

- [ ] **Step 3: `headerCorIconeUsuario` — linha 139 (ícone dentro do avatar)**

Trocar:
```html
      <div style="width:44px;height:44px;border-radius:50%;background:#FFF3DC;border:2px solid #F2C078;flex:none;display:flex;align-items:center;justify-content:center;color:#B5161C;">
```
por:
```html
      <div style="width:44px;height:44px;border-radius:50%;background:#FFF3DC;border:2px solid #F2C078;flex:none;display:flex;align-items:center;justify-content:center;color:var(--header-cor-icone-usuario, #B5161C);">
```

- [ ] **Step 4: `headerCorSaudacao` — linha 141 (texto `{{ saudacao }}`)**

Trocar:
```html
        <div style="font-size:13px;color:#8A1C12;font-weight:600;">{{ saudacao }}</div>
```
por:
```html
        <div style="font-size:13px;color:var(--header-cor-saudacao, #8A1C12);font-weight:600;">{{ saudacao }}</div>
```

- [ ] **Step 5: `headerCorLocalizacao` — linhas 142 e 148 (botão "Entregar em" + botão do sino, mesma cor hoje)**

Trocar (linha 142):
```html
        <button onClick="{{ goCadastro }}" aria-label="Alterar endereço de entrega" style="display:flex;align-items:center;gap:5px;background:none;border:none;color:#7A1209;padding:2px 0 0;cursor:pointer;font-weight:700;font-size:14px;">
```
por:
```html
        <button onClick="{{ goCadastro }}" aria-label="Alterar endereço de entrega" style="display:flex;align-items:center;gap:5px;background:none;border:none;color:var(--header-cor-localizacao, #7A1209);padding:2px 0 0;cursor:pointer;font-weight:700;font-size:14px;">
```

Trocar (linha 148):
```html
      <button onClick="{{ onBell }}" aria-label="Notificações" style="position:relative;width:42px;height:42px;border-radius:14px;background:rgba(122,18,9,.12);border:none;color:#7A1209;display:flex;align-items:center;justify-content:center;cursor:pointer;flex:none;">
```
por:
```html
      <button onClick="{{ onBell }}" aria-label="Notificações" style="position:relative;width:42px;height:42px;border-radius:14px;background:rgba(122,18,9,.12);border:none;color:var(--header-cor-localizacao, #7A1209);display:flex;align-items:center;justify-content:center;cursor:pointer;flex:none;">
```

- [ ] **Step 6: `headerCorNotificacao` — linha 150 (pontinho de notificação)**

Trocar:
```html
        <span style="position:absolute;top:8px;right:9px;width:8px;height:8px;border-radius:50%;background:#B5161C;border:2px solid #F2B705;"></span>
```
por:
```html
        <span style="position:absolute;top:8px;right:9px;width:8px;height:8px;border-radius:50%;background:var(--header-cor-notificacao, #B5161C);border:2px solid var(--header-fundo, #F2B705);"></span>
```

- [ ] **Step 7: Verificação**

```bash
grep -n "header-fundo\|header-cor-" "index.html" | wc -l
```
Esperado: `9` (linhas 84,137 fundo ×2, 139 ícone, 141 saudação, 142+148 localização ×2, 150 notificação+fundo ×2 = 9 ocorrências de `var(--header-`).

- [ ] **Step 8: Commit**

```bash
git add index.html
git commit -m "$(cat <<'EOF'
feat(index): liga o cabeçalho da Home às cores de header do branding

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Barra inferior (bottom nav) — split ícone/texto + fundo

**Files:**
- Modify: `index.html:797, 800, 804, 811, 815, 1825-1827, ~2027-2028` (enrich)

- [ ] **Step 1: `navInferiorFundo` — linha 797**

Trocar:
```html
<div id="bf-bottom-nav" style="display:flex;background:#fff;border-top:1px solid rgba(29,16,9,.07);padding:8px 6px calc(8px + env(safe-area-inset-bottom));flex:none;box-shadow:0 -4px 18px rgba(29,16,9,.05);">
```
por:
```html
<div id="bf-bottom-nav" style="display:flex;background:var(--nav-inferior-fundo, #fff);border-top:1px solid rgba(29,16,9,.07);padding:8px 6px calc(8px + env(safe-area-inset-bottom));flex:none;box-shadow:0 -4px 18px rgba(29,16,9,.05);">
```

- [ ] **Step 2: Separar cor do ícone (mantém em `navBtn`) da cor do texto (`<span>` próprio) — trocar `navBtn`**

Em `index.html:1825-1827`, trocar:
```js
    const navBtn = (on) => ({ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:'4px',
      background:'none', border:'none', cursor:'pointer', padding:'6px 0',
      color: on ? '#D62828' : '#A89A88' });
```
por:
```js
    const navBtn = (on) => ({ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:'4px',
      background:'none', border:'none', cursor:'pointer', padding:'6px 0',
      color: on ? 'var(--nav-inferior-icone-ativo, #D62828)' : 'var(--nav-inferior-icone-normal, #A89A88)' });
    const navTextStyle = (on) => ({ color: on ? 'var(--nav-inferior-texto-ativo, #D62828)' : 'var(--nav-inferior-texto-normal, #A89A88)' });
```

- [ ] **Step 3: Expor os 4 estilos de texto no objeto retornado por `renderVals`/`enrich`**

Localizar a linha (por volta de `index.html:2027`):
```js
      navHomeStyle:navBtn(isHome), navMenuStyle:navBtn(isMenu), navCartStyle:navBtn(isCart), navContaStyle:navBtn(isConta),
```
Trocar por:
```js
      navHomeStyle:navBtn(isHome), navMenuStyle:navBtn(isMenu), navCartStyle:navBtn(isCart), navContaStyle:navBtn(isConta),
      navHomeTextStyle:navTextStyle(isHome), navMenuTextStyle:navTextStyle(isMenu), navCartTextStyle:navTextStyle(isCart), navContaTextStyle:navTextStyle(isConta),
```

- [ ] **Step 4: Usar os novos estilos nos 4 `<span>` de texto (linhas 800, 804, 811, 815)**

Trocar cada uma das 4 linhas — de:
```html
    <span style="font-size:11px;font-weight:600;">Início</span>
```
```html
    <span style="font-size:11px;font-weight:600;">{{ labelCardapio }}</span>
```
```html
      <span style="font-size:11px;font-weight:600;">Carrinho</span>
```
```html
    <span style="font-size:11px;font-weight:600;">Conta</span>
```
para (cada um ganha `{{ navXTextStyle }}` mesclado via `style="font-size:11px;font-weight:600;{{ navXTextStyle }}"` — como o runtime DC não faz merge automático de dois `style=`, a forma mais simples e consistente com o resto do arquivo é embutir a cor direto, já que o restante do estilo é estático):
```html
    <span style="font-size:11px;font-weight:600;color:{{ navHomeTextStyle.color }};">Início</span>
```
```html
    <span style="font-size:11px;font-weight:600;color:{{ navMenuTextStyle.color }};">{{ labelCardapio }}</span>
```
```html
      <span style="font-size:11px;font-weight:600;color:{{ navCartTextStyle.color }};">Carrinho</span>
```
```html
    <span style="font-size:11px;font-weight:600;color:{{ navContaTextStyle.color }};">Conta</span>
```

- [ ] **Step 5: Verificação**

Abrir `index.html?_tenant=<slug-dev>` no navegador, ir pra Home (aba "Início" ativa) e conferir visualmente: ícone e texto do item ativo na cor `--nav-inferior-icone-ativo`/`--nav-inferior-texto-ativo` (mesma cor hoje, já que os dois defaults são iguais — `#D62828`), os outros 3 itens na cor `--nav-inferior-*-normal`. Depois, no DevTools, rodar:
```js
document.documentElement.style.setProperty('--nav-inferior-texto-ativo', '#0000FF')
```
e confirmar que só o TEXTO do item ativo mudou pra azul, mantendo o ÍCONE na cor antiga — prova que a separação funcionou.

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "$(cat <<'EOF'
feat(index): separa cor de ícone e texto da barra inferior, liga ao branding

Antes ícone e texto compartilhavam uma única cor (herdada via currentColor);
agora cada um tem sua própria CSS var, como pedido no grupo Navegação.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Cards de produto e blocos — `corCard`, `cardCorBorda`, `cardCorTitulo`, `cardCorTextoSecundario`, `cardRaioBorda`

**Files:**
- Modify: `index.html:232, 672, 681, 707, 720, 1646, 1650, 1652, 1656, 1752, 1799, 1868`

- [ ] **Step 1: Card de produto (função `enrich`, as duas variantes wide/mobile) — linhas 1646 e 1652**

Trocar:
```js
        cardStyle = { display:'flex', flexDirection:'column', background:'#fff', border:'1px solid rgba(29,16,9,.06)', borderRadius:'8px', boxShadow:'0 6px 18px rgba(29,16,9,.05)', cursor:'pointer', overflow:'hidden' };
```
por:
```js
        cardStyle = { display:'flex', flexDirection:'column', background:'var(--cor-card, #fff)', border:'1px solid var(--card-cor-borda, rgba(29,16,9,.06))', borderRadius:'var(--card-raio-borda, 8px)', boxShadow:'0 6px 18px rgba(29,16,9,.05)', cursor:'pointer', overflow:'hidden' };
```
E, mais abaixo:
```js
        cardStyle = { display:'flex', gap:'14px', background:'#fff', border:'1px solid rgba(29,16,9,.06)', borderRadius:'8px', padding:'12px', boxShadow:'0 6px 18px rgba(29,16,9,.05)', cursor:'pointer', alignItems:'center' };
```
por:
```js
        cardStyle = { display:'flex', gap:'14px', background:'var(--cor-card, #fff)', border:'1px solid var(--card-cor-borda, rgba(29,16,9,.06))', borderRadius:'var(--card-raio-borda, 8px)', padding:'12px', boxShadow:'0 6px 18px rgba(29,16,9,.05)', cursor:'pointer', alignItems:'center' };
```

- [ ] **Step 2: Descrição do card (`descStyle`, wide e mobile) — linhas 1650 e 1656**

Trocar (aparece 2x, uma por variante):
```js
        descStyle = { margin:'0', fontSize:'13px', color:'#7A6C5D', lineHeight:'1.4', display:'-webkit-box', WebkitLineClamp:'2', WebkitBoxOrient:'vertical', overflow:'hidden' };
```
por:
```js
        descStyle = { margin:'0', fontSize:'13px', color:'var(--card-cor-texto-secundario, #7A6C5D)', lineHeight:'1.4', display:'-webkit-box', WebkitLineClamp:'2', WebkitBoxOrient:'vertical', overflow:'hidden' };
```
E:
```js
        descStyle = { margin:'0', fontSize:'13px', color:'#7A6C5D', lineHeight:'1.4', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' };
```
por:
```js
        descStyle = { margin:'0', fontSize:'13px', color:'var(--card-cor-texto-secundario, #7A6C5D)', lineHeight:'1.4', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' };
```

- [ ] **Step 3: Título do card — linha 232**

Trocar:
```html
          <h3 style="font-family:'Bricolage Grotesque',sans-serif;font-weight:700;font-size:15.5px;margin:0 0 3px;line-height:1.2;color:#B5161C;">{{ p.name }}</h3>
```
por:
```html
          <h3 style="font-family:'Bricolage Grotesque',sans-serif;font-weight:700;font-size:15.5px;margin:0 0 3px;line-height:1.2;color:var(--card-cor-titulo, #B5161C);">{{ p.name }}</h3>
```

- [ ] **Step 4: Blocos de card do Checkout (endereço, retirada, troco, resumo) — linhas 672, 681, 707, 720**

Trocar cada uma das 4 linhas abaixo, substituindo só `background:#fff;border:1px solid rgba(29,16,9,.0X)` pela versão com var (mantém o resto do style igual):

Linha 672:
```html
      <div style="display:flex;gap:12px;background:#fff;border:1px solid rgba(29,16,9,.08);border-radius:16px;padding:14px;align-items:center;box-shadow:0 4px 12px rgba(29,16,9,.04);">
```
→
```html
      <div style="display:flex;gap:12px;background:var(--cor-card, #fff);border:1px solid var(--card-cor-borda, rgba(29,16,9,.08));border-radius:16px;padding:14px;align-items:center;box-shadow:0 4px 12px rgba(29,16,9,.04);">
```

Linha 681 (idêntica, mesma troca):
```html
      <div style="display:flex;gap:12px;background:#fff;border:1px solid rgba(29,16,9,.08);border-radius:16px;padding:14px;align-items:center;box-shadow:0 4px 12px rgba(29,16,9,.04);">
```
→ mesma substituição do Step 4/linha 672.

Linha 707:
```html
      <div style="margin-top:10px;background:#fff;border:1px solid rgba(29,16,9,.08);border-radius:16px;padding:14px;box-shadow:0 4px 12px rgba(29,16,9,.04);">
```
→
```html
      <div style="margin-top:10px;background:var(--cor-card, #fff);border:1px solid var(--card-cor-borda, rgba(29,16,9,.08));border-radius:16px;padding:14px;box-shadow:0 4px 12px rgba(29,16,9,.04);">
```

Linha 720:
```html
    <div style="background:#fff;border:1px solid rgba(29,16,9,.06);border-radius:16px;padding:14px;box-shadow:0 4px 12px rgba(29,16,9,.04);">
```
→
```html
    <div style="background:var(--cor-card, #fff);border:1px solid var(--card-cor-borda, rgba(29,16,9,.06));border-radius:16px;padding:14px;box-shadow:0 4px 12px rgba(29,16,9,.04);">
```

**Atenção:** as linhas 672 e 681 têm texto **idêntico** — usar `replace_all` nesse trecho específico substitui as duas de uma vez (é o comportamento desejado aqui).

- [ ] **Step 5: Cards selecionáveis (forma de pagamento, opção de marmita, bairro) — cor de fundo e borda não-selecionada**

Linha 1750-1756 (`optBtnStyle`, marmita):
```js
    const optBtnStyle = (selecionado, esgotado) => ({
      display:'flex', alignItems:'center', gap:'10px', width:'100%', textAlign:'left',
      border: selecionado ? '2px solid #D62828' : '1px solid rgba(29,16,9,.1)',
      background: esgotado ? '#F6F1E7' : '#fff', borderRadius:'13px', padding:'13px 14px',
      cursor: esgotado ? 'not-allowed' : 'pointer', opacity: esgotado ? .55 : 1,
      fontWeight:600, fontSize:'14px', color:'#1D1009'
    });
```
trocar a linha do `border` e a do `background` (a borda "selecionado" fica pra Task 9 — `botaoPrimarioBorda` — não mexer nela aqui):
```js
    const optBtnStyle = (selecionado, esgotado) => ({
      display:'flex', alignItems:'center', gap:'10px', width:'100%', textAlign:'left',
      border: selecionado ? '2px solid #D62828' : '1px solid var(--card-cor-borda, rgba(29,16,9,.1))',
      background: esgotado ? '#F6F1E7' : 'var(--cor-card, #fff)', borderRadius:'13px', padding:'13px 14px',
      cursor: esgotado ? 'not-allowed' : 'pointer', opacity: esgotado ? .55 : 1,
      fontWeight:600, fontSize:'14px', color:'#1D1009'
    });
```

Linha 1797-1800 (`payBtn`, forma de pagamento):
```js
    const payBtn = (on) => ({ display:'flex', alignItems:'center', gap:'13px', width:'100%', cursor:'pointer',
      background:'#fff', borderRadius:'16px', padding:'14px', textAlign:'left',
      border: on ? '2px solid #D62828' : '1px solid rgba(29,16,9,.1)',
      boxShadow: on ? '0 6px 16px rgba(214,40,40,.16)' : '0 3px 10px rgba(29,16,9,.04)' });
```
trocar `background` e o ramo "não selecionado" do `border` (mesma regra — o ramo selecionado fica pra Task 9):
```js
    const payBtn = (on) => ({ display:'flex', alignItems:'center', gap:'13px', width:'100%', cursor:'pointer',
      background:'var(--cor-card, #fff)', borderRadius:'16px', padding:'14px', textAlign:'left',
      border: on ? '2px solid #D62828' : '1px solid var(--card-cor-borda, rgba(29,16,9,.1))',
      boxShadow: on ? '0 6px 16px rgba(214,40,40,.16)' : '0 3px 10px rgba(29,16,9,.04)' });
```

Linha 1866-1871 (`bairroOptStyle`):
```js
    const bairroOptStyle = (selecionado) => ({
      display:'flex', alignItems:'center', justifyContent:'space-between', gap:'10px', width:'100%', textAlign:'left',
      border: selecionado ? '2px solid #D62828' : '1px solid rgba(29,16,9,.1)',
      background:'#fff', borderRadius:'13px', padding:'14px 15px',
      cursor:'pointer', fontWeight:700, fontSize:'15px', color:'#1D1009'
    });
```
trocar:
```js
    const bairroOptStyle = (selecionado) => ({
      display:'flex', alignItems:'center', justifyContent:'space-between', gap:'10px', width:'100%', textAlign:'left',
      border: selecionado ? '2px solid #D62828' : '1px solid var(--card-cor-borda, rgba(29,16,9,.1))',
      background:'var(--cor-card, #fff)', borderRadius:'13px', padding:'14px 15px',
      cursor:'pointer', fontWeight:700, fontSize:'15px', color:'#1D1009'
    });
```

- [ ] **Step 6: Verificação**

```bash
grep -c "var(--cor-card\|var(--card-cor-\|var(--card-raio-borda" "index.html"
```
Esperado: pelo menos `13` ocorrências (2 cardStyle backgrounds + 2 cardStyle bordas + 2 raios + 2 descStyle + 1 título + 4 blocos checkout + 3 background dos seletores + 2 bordas não-selecionadas dos seletores — conferir que não ficou nenhuma abaixo do esperado; se dor menor, alguma substituição não bateu o texto exato, reabrir o arquivo na linha indicada e comparar).

- [ ] **Step 7: Commit**

```bash
git add index.html
git commit -m "$(cat <<'EOF'
feat(index): liga cards de produto e blocos do checkout ao branding

corCard, cardCorBorda, cardCorTitulo, cardCorTextoSecundario e
cardRaioBorda passam a vir de CSS var em vez de hardcoded.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: `botaoPrimarioBorda` — borda de destaque em elementos selecionáveis + outline de foco

**Files:**
- Modify: `index.html:27, 1752, 1799, 1868`

- [ ] **Step 1: Outline de foco — linha 27**

Trocar:
```html
  button:focus-visible,a:focus-visible,input:focus-visible,textarea:focus-visible{outline:2px solid #D62828;outline-offset:2px;}
```
por:
```html
  button:focus-visible,a:focus-visible,input:focus-visible,textarea:focus-visible{outline:2px solid var(--botao-primario-borda, #D62828);outline-offset:2px;}
```

- [ ] **Step 2: Ramo "selecionado" de `optBtnStyle`, `payBtn` e `bairroOptStyle`**

Nas 3 linhas já tocadas na Task 8 (Step 5), trocar só o literal `'2px solid #D62828'` (ramo `selecionado`/`on` verdadeiro) por `'2px solid var(--botao-primario-borda, #D62828)'`:

`optBtnStyle` (linha 1752 após a Task 8): `border: selecionado ? '2px solid var(--botao-primario-borda, #D62828)' : 'var(--card-cor-borda, rgba(29,16,9,.1))',` — manter o resto igual ao que já ficou na Task 8.

`payBtn` (linha 1799 após a Task 8): `border: on ? '2px solid var(--botao-primario-borda, #D62828)' : '1px solid var(--card-cor-borda, rgba(29,16,9,.1))',`

`bairroOptStyle` (linha 1868 após a Task 8): `border: selecionado ? '2px solid var(--botao-primario-borda, #D62828)' : '1px solid var(--card-cor-borda, rgba(29,16,9,.1))',`

- [ ] **Step 3: Verificação**

```bash
grep -c "var(--botao-primario-borda" "index.html"
```
Esperado: `4`.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "$(cat <<'EOF'
feat(index): liga borda de foco e de item selecionado a botaoPrimarioBorda

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: `botaoPrimarioTexto` — texto branco sobre fundo `botaoPrimarioFundo`

**Files:**
- Modify: `index.html` (todas as ocorrências de `color:#fff` no mesmo atributo `style` que `background:#D62828`)

- [ ] **Step 1: Localizar todas as ocorrências**

```bash
grep -noE 'style="[^"]*background:#D62828[^"]*color:#fff[^"]*"|style="[^"]*color:#fff[^"]*background:#D62828[^"]*"' "index.html"
```
Isso lista todo `style="..."` HTML que tem `background:#D62828` E `color:#fff` juntos (qualquer ordem). Anotar os números de linha retornados.

- [ ] **Step 2: Em cada linha listada, trocar só o `color:#fff` (não o `#fff` de nenhum outro lugar da mesma linha) por `color:var(--botao-primario-texto, #fff)`**

Fazer essa troca manualmente linha por linha (não é seguro automatizar globalmente porque `#fff` aparece com outros significados na mesma linha em alguns casos, ex: bordas). Exemplo concreto — linha 121:

Trocar:
```html
  <button onClick="{{ goCart }}" aria-label="Carrinho" style="margin-left:auto;position:relative;display:flex;align-items:center;gap:9px;background:#D62828;color:#fff;border:none;border-radius:14px;padding:10px 16px;font-weight:700;cursor:pointer;">
```
por:
```html
  <button onClick="{{ goCart }}" aria-label="Carrinho" style="margin-left:auto;position:relative;display:flex;align-items:center;gap:9px;background:#D62828;color:var(--botao-primario-texto, #fff);border:none;border-radius:14px;padding:10px 16px;font-weight:700;cursor:pointer;">
```

Repetir o mesmo padrão de troca (`background:#D62828;color:#fff` → `background:#D62828;color:var(--botao-primario-texto, #fff)`, preservando a ordem exata dos dois em cada linha encontrada) para cada linha retornada pelo Step 1.

- [ ] **Step 3: Verificação — nenhuma ocorrência sobrou**

```bash
grep -c 'background:#D62828;color:#fff\|color:#fff;.*background:#D62828' "index.html"
```
Esperado: `0`.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "$(cat <<'EOF'
feat(index): liga texto dos botões primários (fundo D62828) a botaoPrimarioTexto

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## PARTE D — `index.html` — sweep geral (depois dos overrides acima)

### Task 11: Sweep — `corFundo` (`#FFF6D6`)

**Files:** Modify: `index.html` (todas as ocorrências restantes)

- [ ] **Step 1: Contar ocorrências antes**
```bash
grep -c '#FFF6D6' "index.html"
```
- [ ] **Step 2: Substituir cada ocorrência de `#FFF6D6` por `var(--cor-fundo, #FFF6D6)`**, preservando o texto ao redor (ex: `background:#FFF6D6` → `background:var(--cor-fundo, #FFF6D6)`; dentro de string JS `'#FFF6D6'` → `'var(--cor-fundo, #FFF6D6)'`). Usar find-and-replace do editor no arquivo inteiro, já que `#FFF6D6` não tem nenhum override anterior que a conflite (não foi tocado nas Tasks 6-10).
- [ ] **Step 3: Verificar que não sobrou nenhuma ocorrência do hex puro**
```bash
grep -c '#FFF6D6' "index.html"
```
Esperado: `0` (todas agora estão dentro de `var(--cor-fundo, #FFF6D6)`, então o grep acima ainda vai bater nelas — trocar o grep de verificação para `grep -vc 'var(--cor-fundo' "index.html" | grep -c '#FFF6D6'`, ou simplesmente abrir 2-3 ocorrências ao acaso no editor e conferir visualmente que viraram `var(...)`).
- [ ] **Step 4: Commit**
```bash
git add index.html && git commit -m "$(cat <<'EOF'
feat(index): liga corFundo (#FFF6D6) ao branding via CSS var

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

### Task 12: Sweep — `corFundoSecundaria` (`#FFF3DC`)

**Files:** Modify: `index.html` (todas as ocorrências restantes)

- [ ] **Step 1:** `grep -c '#FFF3DC' "index.html"` (contar antes)
- [ ] **Step 2:** Substituir cada `#FFF3DC` por `var(--cor-fundo-secundaria, #FFF3DC)` em todo o arquivo (nenhum override anterior tocou esse valor).
- [ ] **Step 3:** Abrir 2-3 ocorrências ao acaso e confirmar visualmente que viraram `var(--cor-fundo-secundaria, #FFF3DC)`.
- [ ] **Step 4: Commit**
```bash
git add index.html && git commit -m "$(cat <<'EOF'
feat(index): liga corFundoSecundaria (#FFF3DC) ao branding via CSS var

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

### Task 13: Sweep — `corPrimaria` (`#B5161C`)

**Files:** Modify: `index.html` (ocorrências restantes — as das Tasks 6 e 8 já foram convertidas e não têm mais o hex puro)

- [ ] **Step 1:** `grep -c '#B5161C' "index.html"` (contar antes — deve ser menor do que o total original, já que a Task 6 tratou linhas 139/150 e a Task 8 tratou a linha 232)
- [ ] **Step 2:** Substituir cada `#B5161C` restante por `var(--cor-primaria, #B5161C)` — cobre `color:`, `stroke=`, e strings JS como `'#B5161C'`/dentro de `linear-gradient(...)`.
- [ ] **Step 3:** Conferir que as linhas 139, 150 e 232 (já migradas nas Tasks 6/8 pros seus próprios tokens) **não** foram re-alteradas — abrir essas 3 linhas e confirmar que continuam `var(--header-cor-icone-usuario, ...)`, `var(--header-cor-notificacao, ...)` e `var(--card-cor-titulo, ...)` respectivamente, não `var(--cor-primaria, ...)`.
- [ ] **Step 4: Commit**
```bash
git add index.html && git commit -m "$(cat <<'EOF'
feat(index): liga corPrimaria (#B5161C) ao branding via CSS var

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

### Task 14: Sweep — `corSecundaria` (`#F2B705`)

**Files:** Modify: `index.html` (ocorrências restantes — linhas 84 e 137 já convertidas na Task 6 para `--header-fundo`; linha 150 (borda) já convertida na Task 6 para `--header-fundo` também)

- [ ] **Step 1:** `grep -c '#F2B705' "index.html"` (contar antes)
- [ ] **Step 2:** Substituir cada `#F2B705` restante por `var(--cor-secundaria, #F2B705)`.
- [ ] **Step 3:** Conferir que as linhas 84, 137 e 150 não foram re-alteradas (devem continuar como `var(--header-fundo, ...)` da Task 6).
- [ ] **Step 4: Commit**
```bash
git add index.html && git commit -m "$(cat <<'EOF'
feat(index): liga corSecundaria (#F2B705) ao branding via CSS var

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

### Task 15: Sweep — `corTexto` (`#1D1009`, só valores sólidos)

**Files:** Modify: `index.html` (ocorrências de `#1D1009` fora de `rgba(29,16,9,...)`)

- [ ] **Step 1:** `grep -c '#1D1009' "index.html"` (contar — este grep já naturalmente não pega `rgba(29,16,9,...)`, que é numérico, então cobre só os casos sólidos certos)
- [ ] **Step 2:** Substituir cada `#1D1009` por `var(--cor-texto, #1D1009)`.
- [ ] **Step 3:** Confirmar que nenhuma ocorrência de `rgba(29,16,9,` foi alterada (esperado — o find-and-replace de `#1D1009` não toca strings `rgba(...)` porque elas não contêm esse literal hex).
- [ ] **Step 4: Commit**
```bash
git add index.html && git commit -m "$(cat <<'EOF'
feat(index): liga corTexto (#1D1009 sólido) ao branding via CSS var

rgba(29,16,9,X) (bordas/sombras translúcidas) fica fora do escopo desta
fase — ver tabela de mapeamento no topo do plano.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

### Task 16: Sweep — `botaoPrimarioFundo` (`#D62828`, o que sobrou)

**Files:** Modify: `index.html` (ocorrências restantes — as das Tasks 9 e 10 já foram convertidas)

- [ ] **Step 1:** `grep -c '#D62828' "index.html"` (contar antes — deve já estar reduzido pelas Tasks 9/10, que trataram os 4 casos de borda-selecionada + outline, mas não os casos de `background:#D62828`/`color:#D62828`/`stroke="#D62828"` genéricos, que ainda estão pendentes)
- [ ] **Step 2:** Substituir cada `#D62828` restante por `var(--botao-primario-fundo, #D62828)` — cobre `background:`, `color:` (texto de accent tipo "Ver tudo"/"Editar"/"Trocar"), `stroke=`, `fill=`, e strings JS em ternários (ex: `active ? '#D62828' : '#FFF3DC'`).
- [ ] **Step 3:** Confirmar que as 4 bordas-selecionadas (Task 9) e os textos brancos sobre fundo D62828 (Task 10) não foram re-alterados — devem continuar `var(--botao-primario-borda, ...)` e `var(--botao-primario-texto, ...)` respectivamente.
- [ ] **Step 4: Commit**
```bash
git add index.html && git commit -m "$(cat <<'EOF'
feat(index): liga botaoPrimarioFundo (#D62828, ex-corBotao) ao branding via CSS var

rgba(214,40,40,X) (sombras translúcidas) fica fora do escopo desta fase.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

### Task 17: Verificação final da migração + teste no navegador

**Files:** Nenhuma alteração — só verificação.

- [ ] **Step 1: Grep de sanidade — nenhum dos 6 hex antigos deve sobrar fora de um `var(...)`**
```bash
for hex in "#FFF6D6" "#FFF3DC" "#B5161C" "#F2B705" "#1D1009" "#D62828"; do
  echo "$hex fora de var():"
  grep -n "$hex" "index.html" | grep -v "var(--" | grep -v "fallback"
done
```
Esperado: cada bloco imprime vazio (todo hex remanescente já está dentro de um `var(--token, #HEX)`, que também contém o próprio hex como fallback — por isso o grep certo é conferir que toda linha com o hex também contém `var(--`, não que o hex sumiu).

- [ ] **Step 2: Abrir no navegador e comparar visualmente**

Com o dev-server rodando (`node scripts/dev-server.js` + backend em `npm run dev`), abrir `http://localhost:5000/index.html?_tenant=<slug-dev>` e o mesmo tenant no super admin lado a lado. Confirmar visualmente que a Home, o Cardápio, o Carrinho e o Checkout estão **idênticos** a como estavam antes desta Parte D (nenhuma cor mudou — só a origem da cor, que agora é `var()`).

- [ ] **Step 3: Confirmar que o MutationObserver do `scripts/tema.js` não é mais necessário pros elementos migrados**

No DevTools, mudar manualmente `document.documentElement.style.setProperty('--cor-primaria', '#00AA00')` e observar que **todo texto/ícone vermelho da Home muda pra verde instantaneamente**, sem esperar o próximo ciclo do `MutationObserver` — confirma que a resolução de `var()` é nativa do navegador, não depende mais da heurística de `aplicarCoresDom`.

---

## PARTE E — Painel (`super.html`)

### Task 18: Sub-abas dentro de MARCA — estado e navegação

**Files:**
- Modify: `super.html:424` (state inicial), `super.html:630-639` (métodos `goAba*`), `super.html:872-874` (enrich)

- [ ] **Step 1: Adicionar estado da sub-aba**

Em `super.html:424`, trocar:
```js
    tenantDetalheId: null, tenantAtual: null, abaDetalhe: 'geral',
```
por:
```js
    tenantDetalheId: null, tenantAtual: null, abaDetalhe: 'geral', subAbaMarca: 'identidade',
```

- [ ] **Step 2: Método pra trocar de sub-aba (não recarrega o branding, só muda a view)**

Logo abaixo de `goAbaMarca()` (`super.html:631-634`), adicionar:
```js
  goSubAbaMarca(sub) { this.setState({ subAbaMarca: sub }); }
```

- [ ] **Step 3: Expor no enrich**

Em `super.html:872-874`, adicionar (junto dos outros `goAba*`/`isAba*`):
```js
      goSubAbaMarca: (sub) => this.goSubAbaMarca(sub),
      isSubAbaIdentidade: s.subAbaMarca === 'identidade', isSubAbaCoresBase: s.subAbaMarca === 'coresBase',
      isSubAbaBotoes: s.subAbaMarca === 'botoes', isSubAbaCards: s.subAbaMarca === 'cards', isSubAbaNavegacao: s.subAbaMarca === 'navegacao',
      subAbaIdentidadeStyle: abaStyle(s.subAbaMarca === 'identidade'), subAbaCoresBaseStyle: abaStyle(s.subAbaMarca === 'coresBase'),
      subAbaBotoesStyle: abaStyle(s.subAbaMarca === 'botoes'), subAbaCardsStyle: abaStyle(s.subAbaMarca === 'cards'),
      subAbaNavegacaoStyle: abaStyle(s.subAbaMarca === 'navegacao'),
```

- [ ] **Step 4: Commit**

```bash
git add super.html
git commit -m "$(cat <<'EOF'
feat(super): adiciona estado de sub-abas dentro da aba Marca

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 19: Reorganizar o HTML da aba MARCA em sub-abas + adicionar campos novos

**Files:**
- Modify: `super.html:237-281`

- [ ] **Step 1: Substituir o bloco inteiro da aba MARCA**

Trocar todo o trecho de `super.html:237-281` (do `<!-- MARCA -->` até o `</sc-if>` que fecha `isAbaMarca`):

```html
        <!-- MARCA -->
        <sc-if value="{{ isAbaMarca }}" hint-placeholder-val="{{ false }}">
        <div style="background:#FFFBF3;border:1px solid rgba(29,16,9,.07);border-radius:18px;padding:20px;box-shadow:0 5px 16px rgba(29,16,9,.05);">

          <div style="display:flex;gap:8px;margin-bottom:20px;flex-wrap:wrap;">
            <button onClick="{{ goSubAbaMarca }}" data-sub="identidade" style="{{ subAbaIdentidadeStyle }}">Identidade Visual</button>
            <button onClick="{{ goSubAbaMarca }}" data-sub="coresBase" style="{{ subAbaCoresBaseStyle }}">Cores Base</button>
            <button onClick="{{ goSubAbaMarca }}" data-sub="botoes" style="{{ subAbaBotoesStyle }}">Botões</button>
            <button onClick="{{ goSubAbaMarca }}" data-sub="cards" style="{{ subAbaCardsStyle }}">Cards e Blocos</button>
            <button onClick="{{ goSubAbaMarca }}" data-sub="navegacao" style="{{ subAbaNavegacaoStyle }}">Navegação</button>
          </div>

          <!-- IDENTIDADE VISUAL -->
          <sc-if value="{{ isSubAbaIdentidade }}" hint-placeholder-val="{{ true }}">
          <div style="display:flex;align-items:center;gap:16px;margin-bottom:20px;">
            <div style="width:64px;height:64px;border-radius:14px;overflow:hidden;background:#F6F1E7;border:1px solid rgba(29,16,9,.08);flex:none;display:flex;align-items:center;justify-content:center;">
              <sc-if value="{{ hasLogoPreview }}" hint-placeholder-val="{{ false }}"><img sc-camel-src="{{ logoPreviewSrc }}" alt="Logo" style="width:100%;height:100%;object-fit:contain;"/></sc-if>
              <sc-if value="{{ semLogoPreview }}" hint-placeholder-val="{{ true }}"><span style="font-size:11px;color:#8C8075;">sem logo</span></sc-if>
            </div>
            <div style="flex:1;">
              <input type="file" accept="image/*" onChange="{{ onLogoFile }}" style="font-size:12.5px;"/>
              <button onClick="{{ enviarLogo }}" style="display:block;margin-top:8px;background:#6B2E12;color:#FFF3DC;border:none;border-radius:10px;padding:8px 14px;font-weight:700;font-size:12.5px;cursor:pointer;">{{ enviarLogoLabel }}</button>
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
            <div><label style="display:block;font-size:12.5px;font-weight:600;color:#6B2E12;margin-bottom:5px;">Fonte dos títulos</label>
              <select value="{{ fonteTitulo }}" onChange="{{ onFonteTitulo }}" style="width:100%;border:1px solid rgba(29,16,9,.14);background:#fff;border-radius:10px;padding:10px 13px;font-size:14px;outline:none;">
                <sc-for list="{{ fontesOptions }}" as="f" hint-placeholder-count="8"><option value="{{ f }}">{{ f }}</option></sc-for>
              </select>
            </div>
            <div><label style="display:block;font-size:12.5px;font-weight:600;color:#6B2E12;margin-bottom:5px;">Fonte dos textos</label>
              <select value="{{ fonteTexto }}" onChange="{{ onFonteTexto }}" style="width:100%;border:1px solid rgba(29,16,9,.14);background:#fff;border-radius:10px;padding:10px 13px;font-size:14px;outline:none;">
                <sc-for list="{{ fontesOptions }}" as="f2" hint-placeholder-count="8"><option value="{{ f2 }}">{{ f2 }}</option></sc-for>
              </select>
            </div>
          </div>
          </sc-if>

          <!-- CORES BASE -->
          <sc-if value="{{ isSubAbaCoresBase }}" hint-placeholder-val="{{ false }}">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
            {{ campoCor('Fundo principal', 'corFundo') }}
            {{ campoCor('Fundo secundário', 'corFundoSecundaria') }}
            {{ campoCor('Primária', 'corPrimaria') }}
            {{ campoCor('Secundária', 'corSecundaria') }}
            {{ campoCor('Destaque', 'corDestaque') }}
            {{ campoCor('Sucesso', 'corSucesso') }}
            {{ campoCor('Alerta', 'corAlerta') }}
            {{ campoCor('Erro', 'corErro') }}
            {{ campoCor('Texto', 'corTexto') }}
          </div>
          </sc-if>

          <!-- BOTÕES -->
          <sc-if value="{{ isSubAbaBotoes }}" hint-placeholder-val="{{ false }}">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
            {{ campoCor('Primário — fundo', 'botaoPrimarioFundo') }}
            {{ campoCor('Primário — texto', 'botaoPrimarioTexto') }}
            {{ campoCor('Primário — borda', 'botaoPrimarioBorda') }}
            {{ campoCor('Secundário — fundo', 'botaoSecundarioFundo') }}
            {{ campoCor('Secundário — texto', 'botaoSecundarioTexto') }}
            {{ campoCor('Secundário — borda', 'botaoSecundarioBorda') }}
            {{ campoCor('Desabilitado — fundo', 'botaoDesabilitadoFundo') }}
            {{ campoCor('Desabilitado — texto', 'botaoDesabilitadoTexto') }}
          </div>
          </sc-if>

          <!-- CARDS E BLOCOS -->
          <sc-if value="{{ isSubAbaCards }}" hint-placeholder-val="{{ false }}">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
            {{ campoCor('Fundo', 'corCard') }}
            {{ campoCor('Borda', 'cardCorBorda') }}
            {{ campoCor('Título', 'cardCorTitulo') }}
            {{ campoCor('Texto secundário', 'cardCorTextoSecundario') }}
            {{ campoCor('Hover/seleção', 'cardCorHover') }}
          </div>
          <div style="margin-top:14px;"><label style="display:block;font-size:12.5px;font-weight:600;color:#6B2E12;margin-bottom:5px;">Raio da borda</label>
            <input type="text" value="{{ branding.cardRaioBorda }}" onChange="{{ onCardRaioBorda }}" placeholder="8px" style="width:160px;border:1px solid rgba(29,16,9,.14);border-radius:8px;padding:9px 10px;font-family:'DM Mono',monospace;font-size:13px;"/>
          </div>
          </sc-if>

          <!-- NAVEGAÇÃO -->
          <sc-if value="{{ isSubAbaNavegacao }}" hint-placeholder-val="{{ false }}">
          <div style="font-weight:700;font-size:13px;color:#6B2E12;margin-bottom:8px;">Cabeçalho</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:20px;">
            {{ campoCor('Fundo', 'headerFundo') }}
            {{ campoCor('Saudação', 'headerCorSaudacao') }}
            {{ campoCor('Ícone do usuário', 'headerCorIconeUsuario') }}
            {{ campoCor('Localização', 'headerCorLocalizacao') }}
            {{ campoCor('Notificações', 'headerCorNotificacao') }}
          </div>
          <div style="font-weight:700;font-size:13px;color:#6B2E12;margin-bottom:8px;">Barra inferior</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
            {{ campoCor('Fundo', 'navInferiorFundo') }}
            {{ campoCor('Ícone normal', 'navInferiorIconeNormal') }}
            {{ campoCor('Ícone ativo', 'navInferiorIconeAtivo') }}
            {{ campoCor('Texto normal', 'navInferiorTextoNormal') }}
            {{ campoCor('Texto ativo', 'navInferiorTextoAtivo') }}
          </div>
          </sc-if>

          <sc-if value="{{ hasContrasteAviso }}" hint-placeholder-val="{{ false }}">
            <p style="margin:14px 0 0;font-size:12.5px;font-weight:600;color:#B45309;background:#FFF3DC;border:1px solid #F2C078;border-radius:10px;padding:9px 12px;">⚠ Contraste baixo em: {{ contrasteAvisoLabel }} — ainda pode salvar, mas pode ficar difícil de ler.</p>
          </sc-if>
          <sc-if value="{{ hasBrandingMsg }}" hint-placeholder-val="{{ false }}"><p style="margin:14px 0 0;font-size:13px;font-weight:600;color:{{ brandingMsgCor }};">{{ brandingMsg }}</p></sc-if>

          <button onClick="{{ salvarBranding }}" style="margin-top:16px;background:#2D9E60;color:#fff;border:none;border-radius:10px;padding:11px 18px;font-weight:700;font-size:14px;cursor:pointer;">{{ salvarBrandingLabel }}</button>
        </div>
        </sc-if>
```

**Nota importante sobre `{{ campoCor(...) }}`**: o runtime DC deste projeto (visto em todo o resto do `super.html`) não tem uma sintaxe de "componente"/helper de template reutilizável — cada campo hoje é escrito por extenso (ver o bloco original, 7 campos repetidos manualmente). `{{ campoCor('Label', 'nomeDoCampo') }}` **não é sintaxe válida do DC** — foi usado acima só como abreviação de leitura. O Step 2 abaixo expande isso pro HTML literal de cada campo, igual ao padrão já existente no arquivo.

- [ ] **Step 2: Expandir cada `{{ campoCor(...) }}` pro HTML literal**

Para cada um dos 27 campos de cor listados acima (9 em Cores Base + 8 em Botões + 5 em Cards + 10 em Navegação — total 32, todos exceto `cardRaioBorda` que já foi escrito por extenso), substituir a linha `{{ campoCor('Label', 'nomeCampo') }}` pelo HTML no mesmo formato do campo `Cor primária` original (visto em `super.html:252` antes desta task), trocando só o texto do label, o nome do campo em `{{ branding.nomeCampo }}` e o handler `onChange`:

```html
<div><label style="display:block;font-size:12.5px;font-weight:600;color:#6B2E12;margin-bottom:5px;">Label</label><div style="display:flex;gap:8px;align-items:center;"><div style="width:38px;height:38px;flex:none;border-radius:8px;border:1px solid rgba(29,16,9,.14);background:{{ branding.nomeCampo }};"></div><input type="text" value="{{ branding.nomeCampo }}" onChange="{{ onCorNomeCampo }}" placeholder="#RRGGBB" maxlength="7" style="flex:1;min-width:0;border:1px solid rgba(29,16,9,.14);border-radius:8px;padding:9px 10px;font-family:'DM Mono',monospace;font-size:13px;text-transform:uppercase;"/></div></div>
```

Exemplo concreto pro primeiro campo (Cores Base → Fundo principal):
```html
<div><label style="display:block;font-size:12.5px;font-weight:600;color:#6B2E12;margin-bottom:5px;">Fundo principal</label><div style="display:flex;gap:8px;align-items:center;"><div style="width:38px;height:38px;flex:none;border-radius:8px;border:1px solid rgba(29,16,9,.14);background:{{ branding.corFundo }};"></div><input type="text" value="{{ branding.corFundo }}" onChange="{{ onCorFundo }}" placeholder="#RRGGBB" maxlength="7" style="flex:1;min-width:0;border:1px solid rgba(29,16,9,.14);border-radius:8px;padding:9px 10px;font-family:'DM Mono',monospace;font-size:13px;text-transform:uppercase;"/></div></div>
```

Repetir para os outros 31 campos, usando `onCor<NomeDoCampoEmPascalCase>` como nome do handler (ex: campo `corFundoSecundaria` → handler `onCorFundoSecundaria`; campo `botaoPrimarioFundo` → handler `onBotaoPrimarioFundo`). A Task 20 cria todos esses handlers.

**Nota:** os campos existentes usavam `{{ corPrimaria }}` (sem prefixo `branding.`) porque `renderVals()` espalhava cada campo do branding solto no objeto retornado (ver `super.html` antes desta task — não confirmado neste plano se há um espalhamento assim em algum lugar de `enrich`/`renderVals`; **antes de aplicar este Step, rodar `grep -n "corPrimaria:" super.html` e conferir**: se existir uma linha tipo `corPrimaria: s.branding ? s.branding.corPrimaria : ''` dentro de `renderVals`, manter o padrão `{{ corPrimaria }}` sem prefixo pra TODOS os campos novos também, e adicionar o espalhamento equivalente pra cada campo novo nesse mesmo bloco; se não existir tal linha e `{{ corPrimaria }}` funcionava por outro mecanismo, usar `{{ branding.corPrimaria }}` como escrito acima e ajustar os campos originais (Cores Base primária/secundária/texto) pra combinar.

- [ ] **Step 3: Commit**

```bash
git add super.html
git commit -m "$(cat <<'EOF'
feat(super): reorganiza aba Marca em sub-abas e adiciona os campos novos

Identidade Visual / Cores Base / Botões / Cards e Blocos / Navegação —
32 campos de cor exibidos ao todo (27 novos + 5 já existentes, reorganizados).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 20: Handlers dos campos novos + expandir `salvarBranding`

**Files:**
- Modify: `super.html:660-684`

- [ ] **Step 1: Adicionar um handler genérico por campo, seguindo o padrão de `onCorPrimaria`/`onCorCampo` já existente**

Depois da linha (`super.html:667`):
```js
  onCorCard(e) { this.onCorCampo('corCard', e); }
```
adicionar, um por linha, reaproveitando `onCorCampo` (já existe e faz `setState` genérico por nome de campo):
```js
  onCorFundoSecundaria(e) { this.onCorCampo('corFundoSecundaria', e); }
  onCorDestaque(e) { this.onCorCampo('corDestaque', e); }
  onCorSucesso(e) { this.onCorCampo('corSucesso', e); }
  onCorAlerta(e) { this.onCorCampo('corAlerta', e); }
  onCorErro(e) { this.onCorCampo('corErro', e); }
  onBotaoPrimarioFundo(e) { this.onCorCampo('botaoPrimarioFundo', e); }
  onBotaoPrimarioTexto(e) { this.onCorCampo('botaoPrimarioTexto', e); }
  onBotaoPrimarioBorda(e) { this.onCorCampo('botaoPrimarioBorda', e); }
  onBotaoSecundarioFundo(e) { this.onCorCampo('botaoSecundarioFundo', e); }
  onBotaoSecundarioTexto(e) { this.onCorCampo('botaoSecundarioTexto', e); }
  onBotaoSecundarioBorda(e) { this.onCorCampo('botaoSecundarioBorda', e); }
  onBotaoDesabilitadoFundo(e) { this.onCorCampo('botaoDesabilitadoFundo', e); }
  onBotaoDesabilitadoTexto(e) { this.onCorCampo('botaoDesabilitadoTexto', e); }
  onCardCorBorda(e) { this.onCorCampo('cardCorBorda', e); }
  onCardCorTitulo(e) { this.onCorCampo('cardCorTitulo', e); }
  onCardCorTextoSecundario(e) { this.onCorCampo('cardCorTextoSecundario', e); }
  onCardCorHover(e) { this.onCorCampo('cardCorHover', e); }
  onCardRaioBorda(e) { this.setState(s => ({ branding: { ...s.branding, cardRaioBorda: e.target.value } })); }
  onHeaderFundo(e) { this.onCorCampo('headerFundo', e); }
  onHeaderCorSaudacao(e) { this.onCorCampo('headerCorSaudacao', e); }
  onHeaderCorIconeUsuario(e) { this.onCorCampo('headerCorIconeUsuario', e); }
  onHeaderCorLocalizacao(e) { this.onCorCampo('headerCorLocalizacao', e); }
  onHeaderCorNotificacao(e) { this.onCorCampo('headerCorNotificacao', e); }
  onNavInferiorFundo(e) { this.onCorCampo('navInferiorFundo', e); }
  onNavInferiorIconeNormal(e) { this.onCorCampo('navInferiorIconeNormal', e); }
  onNavInferiorIconeAtivo(e) { this.onCorCampo('navInferiorIconeAtivo', e); }
  onNavInferiorTextoNormal(e) { this.onCorCampo('navInferiorTextoNormal', e); }
  onNavInferiorTextoAtivo(e) { this.onCorCampo('navInferiorTextoAtivo', e); }
```

- [ ] **Step 2: Remover `corBotao`/`corTextoBotao`, adicionar todos os campos novos no payload de `salvarBranding`**

Trocar (`super.html:676-679`):
```js
      const { branding, contraste } = await this.apiSend('PATCH', '/super/tenants/' + id + '/branding', {
        corPrimaria: b.corPrimaria, corSecundaria: b.corSecundaria, corBotao: b.corBotao, corTextoBotao: b.corTextoBotao,
        corFundo: b.corFundo, corTexto: b.corTexto, corCard: b.corCard, fonteTitulo: b.fonteTitulo, fonteTexto: b.fonteTexto,
      });
```
por:
```js
      const { branding, contraste } = await this.apiSend('PATCH', '/super/tenants/' + id + '/branding', {
        corPrimaria: b.corPrimaria, corSecundaria: b.corSecundaria, corFundo: b.corFundo, corFundoSecundaria: b.corFundoSecundaria,
        corTexto: b.corTexto, corDestaque: b.corDestaque, corSucesso: b.corSucesso, corAlerta: b.corAlerta, corErro: b.corErro,
        botaoPrimarioFundo: b.botaoPrimarioFundo, botaoPrimarioTexto: b.botaoPrimarioTexto, botaoPrimarioBorda: b.botaoPrimarioBorda,
        botaoSecundarioFundo: b.botaoSecundarioFundo, botaoSecundarioTexto: b.botaoSecundarioTexto, botaoSecundarioBorda: b.botaoSecundarioBorda,
        botaoDesabilitadoFundo: b.botaoDesabilitadoFundo, botaoDesabilitadoTexto: b.botaoDesabilitadoTexto,
        corCard: b.corCard, cardCorBorda: b.cardCorBorda, cardCorTitulo: b.cardCorTitulo, cardCorTextoSecundario: b.cardCorTextoSecundario,
        cardCorHover: b.cardCorHover, cardRaioBorda: b.cardRaioBorda,
        headerFundo: b.headerFundo, headerCorSaudacao: b.headerCorSaudacao, headerCorIconeUsuario: b.headerCorIconeUsuario,
        headerCorLocalizacao: b.headerCorLocalizacao, headerCorNotificacao: b.headerCorNotificacao,
        navInferiorFundo: b.navInferiorFundo, navInferiorIconeNormal: b.navInferiorIconeNormal, navInferiorIconeAtivo: b.navInferiorIconeAtivo,
        navInferiorTextoNormal: b.navInferiorTextoNormal, navInferiorTextoAtivo: b.navInferiorTextoAtivo,
        fonteTitulo: b.fonteTitulo, fonteTexto: b.fonteTexto,
      });
```

- [ ] **Step 3: Verificação manual completa do painel**

Com backend + dev-server rodando, abrir `super.html`, entrar num tenant, ir na aba Marca, clicar em cada uma das 5 sub-abas, confirmar que os campos aparecem preenchidos com os valores atuais (vindos do `GET /branding`, incluindo os defaults da migration do Task 1). Mudar um valor em cada sub-aba, clicar "Salvar marca", recarregar a página (F5), reabrir a aba Marca e confirmar que os valores persistiram.

- [ ] **Step 4: Commit**

```bash
git add super.html
git commit -m "$(cat <<'EOF'
feat(super): handlers dos campos novos + salvarBranding manda o payload completo

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 21: Live preview — iframe + envio de `postMessage`

**Files:**
- Modify: `super.html` (dentro do bloco `isAbaMarca`, `renderVals`, `onCorCampo`)

- [ ] **Step 1: Adicionar o iframe no HTML, logo depois da barra de sub-abas (dentro do bloco de MARCA, antes de `<!-- IDENTIDADE VISUAL -->`)**

```html
          <div style="margin-bottom:20px;border-radius:14px;overflow:hidden;border:1px solid rgba(29,16,9,.1);height:520px;">
            <iframe ref="{{ setPreviewFrame }}" src="{{ previewUrl }}" title="Preview da loja" style="width:100%;height:100%;border:none;" onLoad="{{ onPreviewFrameLoad }}"></iframe>
          </div>
```

- [ ] **Step 2: Expor `setPreviewFrame`, `previewUrl` e `onPreviewFrameLoad` no `renderVals`**

Perto de onde `tenantSlug` já é montado (`super.html:876`), adicionar:
```js
      previewUrl: s.tenantAtual ? this.urlLoja(s.tenantAtual.slug) : '',
      setPreviewFrame: (el) => { this._previewFrame = el; },
      onPreviewFrameLoad: () => { this._previewFrameReady = true; this.enviarPreview(); },
```

- [ ] **Step 3: Método que envia o `postMessage` — chamado a cada mudança de cor e ao carregar o iframe**

Logo depois de `onCorCampo` (`super.html:660`), adicionar:
```js
  enviarPreview() {
    if (!this._previewFrame || !this._previewFrameReady || !this.state.branding || !this.state.tenantAtual) return;
    var targetOrigin;
    try { targetOrigin = new URL(this.urlLoja(this.state.tenantAtual.slug)).origin; } catch (e) { return; }
    this._previewFrame.contentWindow.postMessage({ type: 'bf-preview-update', branding: this.state.branding }, targetOrigin);
  }
```

- [ ] **Step 4: Chamar `enviarPreview()` a cada troca de campo**

Trocar (`super.html:660`):
```js
  onCorCampo(campo, e) { this.setState(s => ({ branding: { ...s.branding, [campo]: e.target.value } })); }
```
por:
```js
  onCorCampo(campo, e) {
    this.setState(s => ({ branding: { ...s.branding, [campo]: e.target.value } }));
    setTimeout(() => this.enviarPreview(), 0);
  }
```
(o `setTimeout(...,0)` garante que `this.state.branding` já reflete o novo valor antes de montar a mensagem, já que `setState` é assíncrono no runtime DC — mesma técnica seria necessária pra `onCardRaioBorda`; adicionar a mesma chamada `setTimeout(() => this.enviarPreview(), 0);` dentro dele também.)

- [ ] **Step 5: Verificação manual — o núcleo do live preview**

Abrir a aba Marca de um tenant, conferir que o iframe carrega a loja real. Mudar `corPrimaria` no campo de texto — confirmar que, **sem clicar em salvar**, o texto/ícones vermelhos dentro do iframe mudam de cor imediatamente. Repetir para um campo de cada sub-aba (ex: `headerFundo`, `botaoPrimarioFundo`, `cardCorBorda`, `navInferiorIconeAtivo`) e confirmar visualmente cada um.

- [ ] **Step 6: Commit**

```bash
git add super.html
git commit -m "$(cat <<'EOF'
feat(super): live preview via iframe da loja real + postMessage

Cada mudança de campo (antes de salvar) atualiza as CSS vars do iframe
via postMessage, validado por origem no listener de scripts/tema.js.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## PARTE F — Verificação manual completa (equivalente à seção 7 da spec)

### Task 22: Checklist de verificação end-to-end

Sem alteração de código — só execução dos passos abaixo, na ordem, com backend (`cd backend && npm run dev`) e dev-server (`node scripts/dev-server.js`) rodando:

- [ ] 1. `cd backend && npx prisma studio` — conferir que tenants existentes mantiveram os valores antigos nos campos renomeados e que os campos novos têm os defaults extraídos do template (Task 1, Step 4, já feito — repetir aqui só se algo mudou desde então).
- [ ] 2. Abrir `super.html`, entrar num tenant → aba Marca → conferir as 5 sub-abas, cada uma com os campos certos pré-preenchidos.
- [ ] 3. Mudar uma cor em cada sub-aba (`corPrimaria`, `botaoSecundarioFundo`, `cardCorBorda`, `navInferiorIconeAtivo`) e conferir que o iframe de preview reflete a mudança sem salvar.
- [ ] 4. Clicar "Salvar marca", recarregar a página (F5), reabrir a aba Marca, confirmar que os valores persistiram.
- [ ] 5. Abrir `index.html?_tenant=<slug>` fora do painel (aba nova do navegador) e confirmar que a loja real também reflete as cores salvas.
- [ ] 6. Testar um valor de cor inválido (ex: `#ZZZ`) em qualquer campo novo, tentar salvar → confirmar erro 400 (mensagem de erro aparece no painel) e que o valor não foi salvo (recarregar e conferir).
- [ ] 7. Testar uma combinação de baixo contraste (ex: deixar `cardCorTitulo` quase igual a `corCard`) → confirmar que o aviso aparece, mas o save é permitido.
- [ ] 8. Repetir o passo 3 com um segundo tenant, confirmar isolamento (branding de um tenant não aparece no outro).
- [ ] 9. Abrir `garcom.html`/`atendente.html`/`entregador.html` de um tenant onde a marca foi alterada — confirmar que essas telas continuam aplicando a marca corretamente pelo mecanismo heurístico antigo (sem regressão).
- [ ] 10. No `index.html`, testar a Home, Cardápio, Carrinho, Cadastro, Bairro, Marmita, Produto, Checkout e Acompanhar pedido — navegar por todas e confirmar visualmente que nada quebrou (nenhuma cor sumiu, nenhum contraste ficou ilegível) em comparação com o estado antes desta implementação.

---

## Resumo de arquivos tocados

| Arquivo | O que muda |
|---|---|
| `backend/prisma/schema.prisma` | `TenantBranding` ganha ~27 colunas novas, 2 renomeadas |
| `backend/prisma/migrations/20260804210000_evoluir_branding_fase1/migration.sql` | novo |
| `backend/src/utils/branding.js` | `CAMPOS_COR` expandida, validação de `cardRaioBorda` |
| `backend/src/utils/contraste.js` | `calcularContrasteBranding` cobre os novos pares |
| `scripts/tema.js` | injeta `:root{--x:...}`, listener de `postMessage` |
| `index.html` | ~150 ocorrências de cor hardcoded viram `var(--token, fallback)`; bottom nav ganha split ícone/texto |
| `super.html` | aba Marca reorganizada em 5 sub-abas, 27 campos novos, iframe de live preview |

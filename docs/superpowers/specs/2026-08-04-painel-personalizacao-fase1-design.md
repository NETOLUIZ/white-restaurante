# Spec: Evolução do Painel de Personalização Visual — Fase 1 (Fundação + Cores Base, Botões, Cards, Navegação)

**Data:** 2026-08-04
**Status:** Aprovado

---

## Resumo

O painel de personalização de marca já existe (aba "MARCA" em `super.html`, acessível só pelo super admin) e permite editar 7 cores, 2 fontes e logo/favicon do tenant (`TenantBranding`). O pedido original pedia uma evolução grande: até 13 grupos de controles granulares (cores base, cards, botões, navegação, busca, categorias, produtos, bairros, minha conta, textos, tipografia, bordas/espaçamento), live preview e preparo para multi-módulo.

Levantamento do código mostrou que a aplicação de cor hoje **não usa CSS variables** — `scripts/tema.js` varre o DOM inteiro, compara o RGB computado de cada elemento com uma tabela fixa de cores padrão conhecidas (`REGRAS_COR`), e sobrescreve por heurística com `!important`. Esse mecanismo é frágil e de cobertura curada (o próprio código admite que pins de mapa, badges e gradientes decorativos ficam de fora). Adicionar dezenas de controles novos em cima dessa heurística aumentaria o risco de colisão e regressão visual.

Por isso o escopo foi dividido em fases. **Esta spec cobre só a Fase 1**:
1. Migração de `index.html` (app do cliente) para CSS custom properties (`var(--cor-x)`), eliminando a heurística de RGB para os elementos migrados.
2. Reorganização da aba MARCA em sub-abas.
3. Live preview via iframe do storefront real + `postMessage`.
4. Quatro grupos de controles novos: **Cores Base, Botões, Cards e Blocos, Navegação**.

Continua restrito ao super admin (sem mudança no modelo de permissão — o dono do restaurante não ganha acesso direto nesta fase). `garcom.html`, `atendente.html`, `empresa.html`, `entregador.html` e o admin do tenant continuam no mecanismo heurístico atual, sem regressão.

Fora de escopo desta spec (fica para specs futuras, seção 8): Busca, Categorias, Produtos, Bairros, Minha Conta, Textos, Tipografia, Bordas/Espaçamento globais, dark mode, paletas pré-definidas, histórico de versões, acesso do tenant à própria marca, arquitetura de módulos plugáveis (farmácia, mercado etc.).

---

## 1. Arquitetura técnica — CSS variables em `index.html`

- Elementos de `index.html` que hoje têm cor hardcoded (header, botões, cards, nav inferior) passam a referenciar `var(--nome-da-variavel)` no lugar do hex literal.
- `scripts/tema.js` passa a injetar as cores como custom properties no `:root` via o `<style id="bf-tema-tenant">` já existente, além das regras de `body{background,color,font-family}` que já injeta hoje:
  ```css
  :root {
    --cor-primaria: #C8102E;
    --cor-fundo-secundaria: #F7F7F7;
    --botao-primario-fundo: #C8102E;
    --card-cor-borda: #E5E5E5;
    /* ...uma variável por campo novo do TenantBranding, ver seção 3 */
  }
  ```
- Como o valor "original" hardcoded nos templates passa a ser literalmente `var(...)`, o runtime DC pode reinjetar o `style` do jeito que quiser a cada render — o navegador resolve a variável no momento da pintura. **Não precisa mais de `querySelectorAll('body *')` + comparação de RGB + `MutationObserver`/`iniciarPollDom` para os elementos migrados.**
- Elementos ainda não migrados (fora do escopo desta fase, ou em outras telas) continuam cobertos pela tabela `REGRAS_COR` existente, que permanece no código sem alteração — migração é incremental, tela por tela, sem quebrar o que já funciona.
- `aplicarNomeELogo` e a injeção de fontes via Google Fonts (`GOOGLE_FONTS`) não mudam nesta fase.

---

## 2. Escopo de telas da Fase 1

Só `index.html` é migrado. Justificativa: é a tela onde moram os 4 grupos desta fase (cores base, botões, cards, navegação) e é também a tela usada no iframe de live preview (seção 5). As demais telas (`Bel do Frango - Admin.dc.html`, `garcom.html`, `atendente.html`, `empresa.html`, `entregador.html`) entram em fases futuras, sob demanda.

---

## 3. Modelo de dados (`TenantBranding`)

Colunas planas, mesmo padrão do model atual — mantém validação simples por campo (regex hex) e migration explícita por fase.

### Cores Base
Reaproveita `corFundo` (fundo principal), `corPrimaria`, `corSecundaria`. Adiciona:
```prisma
corFundoSecundaria String @default("#F7F7F7")
corDestaque        String @default("#F5A623")
corSucesso         String @default("#16A34A")
corAlerta          String @default("#F59E0B")
corErro            String @default("#DC2626")
```

### Botões
Renomeia (migration preserva dados, `ALTER TABLE ... RENAME COLUMN`):
- `corBotao` → `botaoPrimarioFundo`
- `corTextoBotao` → `botaoPrimarioTexto`

Adiciona:
```prisma
botaoPrimarioBorda    String @default("#C8102E")
botaoSecundarioFundo  String @default("#FFFFFF")
botaoSecundarioTexto  String @default("#C8102E")
botaoSecundarioBorda  String @default("#C8102E")
botaoDesabilitadoFundo String @default("#E5E5E5")
botaoDesabilitadoTexto String @default("#9CA3AF")
```

### Cards e Blocos
Reaproveita `corCard` (fundo). Adiciona:
```prisma
cardCorBorda            String @default("#E5E5E5")
cardCorTitulo           String @default("#1A1A1A")
cardCorTextoSecundario  String @default("#6B7280")
cardCorHover            String @default("#F5F5F5")
cardRaioBorda           String @default("8px")
```

### Navegação
```prisma
// Cabeçalho
headerFundo            String @default("#FFFFFF")
headerCorSaudacao       String @default("#1A1A1A")
headerCorIconeUsuario   String @default("#1A1A1A")
headerCorLocalizacao    String @default("#6B7280")
headerCorNotificacao    String @default("#C8102E")

// Barra inferior
navInferiorFundo        String @default("#FFFFFF")
navInferiorIconeNormal  String @default("#9CA3AF")
navInferiorIconeAtivo   String @default("#C8102E")
navInferiorTextoNormal  String @default("#9CA3AF")
navInferiorTextoAtivo   String @default("#C8102E")
```

**Nota de implementação:** os valores `@default` acima são ilustrativos. Antes de escrever a migration, extrair os valores hex reais hardcoded hoje em `index.html` para cada elemento equivalente, para que tenants existentes não tenham nenhuma mudança visual no dia do deploy (a migration cria as colunas com o default = aparência atual; o super admin edita depois se quiser mudar).

Migration: gerar via `prisma migrate dev` em dev; em produção, `prisma migrate diff` mostrado ao usuário e `prisma migrate deploy` só após confirmação explícita (mesma regra já seguida no projeto).

---

## 4. Validação e contraste (backend)

- `backend/src/utils/branding.js` (`montarDadosBranding`): estende a lista de campos aceitos com os novos nomes, reaproveitando `corValida` (regex hex) para todos os campos de cor novos.
- `cardRaioBorda`: novo regex simples de comprimento CSS (ex: `/^\d+(\.\d+)?(px|rem)$/`), senão `400 ErroValidacaoBranding` — mesmo padrão de erro já usado para cor inválida.
- `backend/src/utils/contraste.js` (`calcularContrasteBranding`): estende os pares checados para incluir os novos textos-sobre-fundo relevantes: `cardCorTitulo`/`cardCorTextoSecundario` sobre `corCard`, `botaoPrimarioTexto` sobre `botaoPrimarioFundo`, `botaoSecundarioTexto` sobre `botaoSecundarioFundo`, `headerCorSaudacao` sobre `headerFundo`, `navInferiorTextoAtivo`/`navInferiorTextoNormal` sobre `navInferiorFundo`. Continua **não bloqueando** o save — só populariza o aviso já existente no painel.
- Rotas (`GET/PATCH /super/tenants/:id/branding`, `GET /config`, `PATCH /config/branding`) não mudam de formato, só o payload cresce com os campos novos — sem breaking change de contrato.

---

## 5. Painel (`super.html`, aba MARCA)

Reorganizada em sub-abas dentro da aba MARCA existente:
- **Identidade Visual** — logo, favicon, fontes (conteúdo que já existe hoje, só realocado).
- **Cores Base**
- **Botões**
- **Cards e Blocos**
- **Navegação**

Cada campo mantém o padrão visual já existente (swatch quadrado + input hex `maxlength="7"`), só agrupado nas sub-abas acima. Sem criar sub-abas vazias para os grupos de fases futuras — elas são adicionadas quando a fase correspondente for implementada.

O botão "Salvar marca" (`salvarBranding`) e o carregamento inicial (`carregarBranding`) continuam funcionando igual, agora populando/enviando o conjunto maior de campos.

---

## 6. Live preview

- Um iframe do `index.html` do próprio tenant é embutido na aba MARCA (`src` usando o mesmo padrão de `?_tenant=slug` já usado no link "Abrir loja").
- A cada mudança de campo no formulário (antes de salvar), o painel envia:
  ```js
  iframeRef.contentWindow.postMessage(
    { type: 'bf-preview-update', branding: { ...currentFormState } },
    ORIGEM_ESPERADA_DO_STOREFRONT
  )
  ```
- `index.html` adiciona um listener de `message` que:
  1. Valida `event.origin` contra o domínio esperado do super admin (evita que qualquer página arbitrária injete cores via postMessage).
  2. Valida `event.data.type === 'bf-preview-update'`.
  3. Aplica cada campo recebido como custom property em `document.documentElement.style.setProperty('--nome-var', valor)` — direto, sem re-rodar heurística de RGB nem esperar fetch.
- Nada é persistido por esse fluxo — é só visual, client-side, no iframe. O botão "Salvar marca" continua sendo o único caminho que grava no banco (`PATCH /branding`).
- Fallback: se o iframe não carregar (bloqueio de terceiros, tenant sem subdomínio configurado em dev), o painel continua funcionando normalmente sem preview — só oculta o bloco do iframe, sem quebrar o resto do formulário.

---

## 7. Testes / verificação manual

1. Rodar a migration em dev (`prisma migrate dev`) e conferir com `npx prisma studio` que os tenants existentes mantiveram os valores antigos nos campos renomeados (`botaoPrimarioFundo` = valor antigo de `corBotao`) e que os campos novos vieram com o default = aparência atual.
2. Abrir `super.html`, aba MARCA de um tenant existente: conferir que as 5 sub-abas aparecem, cada uma com os campos certos, todos pré-preenchidos com o valor salvo.
3. Mudar uma cor em cada sub-aba (ex: `corPrimaria`, `botaoSecundarioFundo`, `cardCorBorda`, `navInferiorIconeAtivo`) e conferir que o iframe de preview reflete a mudança **sem** clicar em salvar.
4. Clicar "Salvar marca", recarregar a página (F5) do painel e confirmar que os valores persistiram (`GET /branding` retorna o que foi salvo).
5. Abrir `index.html` do tenant fora do painel (aba nova) e confirmar que a loja real também reflete as cores salvas — validando que a migração para CSS variables funcionou fora do contexto do iframe.
6. Testar um valor de cor inválido (ex: `#ZZZ`) em qualquer campo novo → confirmar erro 400 e que o save não vai adiante.
7. Testar uma combinação de baixo contraste (ex: `cardCorTitulo` quase igual a `corCard`) → confirmar que aparece o aviso, mas o save ainda é permitido.
8. Repetir o passo 3 com um segundo tenant, confirmando isolamento (branding de um tenant não vaza pro outro — mesma proteção multi-tenant já usada no resto do projeto).
9. Abrir `garcom.html`/`atendente.html`/`entregador.html` de um tenant onde a marca foi alterada e confirmar que essas telas continuam aplicando a marca corretamente pelo mecanismo heurístico antigo (sem regressão nas telas não migradas).

---

## 8. Fases seguintes (fora do escopo desta spec)

Cada grupo abaixo vira uma spec própria, reaproveitando a mesma arquitetura validada na Fase 1 (migrar o template relevante para CSS variables + novas colunas em `TenantBranding` + nova sub-aba no painel):

- Busca, Categorias, Produtos, Bairros, Minha Conta, Textos, Tipografia, Bordas e Espaçamento globais.
- Migração de `Bel do Frango - Admin.dc.html`, `garcom.html`, `atendente.html`, `empresa.html`, `entregador.html` para CSS variables, se/quando algum grupo futuro precisar deles.
- Acesso do dono do restaurante à própria marca (hoje só super admin via impersonation) — mudança de modelo de permissão, não incluída aqui.
- Paletas pré-definidas, dark mode, histórico/versionamento de tema.
- Arquitetura de módulos plugáveis por tipo de negócio (farmácia, mercado completo) — hoje `TipoTenant` é só um enum cosmético; `TenantBranding` já é module-agnostic (não depende de `TipoTenant`), então não é esperado retrabalho estrutural quando esse dia chegar, mas nenhum desenho de módulos foi feito ainda.

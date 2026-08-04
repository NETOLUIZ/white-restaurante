// Fase 6B — aplica o branding do tenant (cor/fonte/logo/nome) em cima do
// visual padrão do Bel do Frango, sem editar nenhum outro arquivo. Nenhuma
// cor aqui é CSS variable hoje (ver audit da Fase 6B) — a maioria vive em
// style="" inline por elemento. Cobertura é curada: só os slots mais
// visíveis (logo, nome, header/título, botão/CTA, fundo, texto base) — pins
// de mapa, badges e gradientes decorativos ficam com a cor original.
//
// Tentativa inicial usava seletor de atributo tipo [style*="background:#HEX"]
// pra sobrepor cor sem tocar no HTML — não funciona: esses elementos são
// renderizados pelo React (runtime DC, support.js), que aplica style via
// CSSOM, não como string. O navegador serializa de volta como
// "background-color: rgb(r, g, b)" (com espaço, notação rgb), nunca o hex
// literal do template original — o seletor de atributo nunca dava match.
// Por isso a troca de cor aqui lê getComputedStyle (sempre normalizado em
// rgb() por spec, previsível entre navegadores) e muta o elemento direto.
//
// Estes 5 arquivos só montam o conteúdo real depois de baixar React de um
// CDN — bem depois de DOMContentLoaded. Por isso cor/nome/logo entram num
// poll curto até os elementos existirem; body{} e o data-feature de esconder
// seção usam CSS puro (aplicam reativamente, sem problema de timing).
(function () {
  'use strict';

  var GOOGLE_FONTS = {
    'Inter': 'Inter:wght@400;700;800',
    'Roboto': 'Roboto:wght@400;700;800',
    'Open Sans': 'Open+Sans:wght@400;700;800',
    'Lato': 'Lato:wght@400;700;900',
    'Source Sans 3': 'Source+Sans+3:wght@400;700;800',
    'Nunito Sans': 'Nunito+Sans:wght@400;700;800',
    'Atkinson Hyperlegible': 'Atkinson+Hyperlegible:wght@400;700',
  };

  // rgb() normalizado (o que getComputedStyle realmente devolve, ver nota
  // acima) do hex atual achado no audit -> propriedade CSSOM -> campo do branding.
  var REGRAS_COR = [
    { rgb: 'rgb(181, 22, 28)', prop: 'color', campo: 'corPrimaria' },
    { rgb: 'rgb(181, 22, 28)', prop: 'backgroundColor', campo: 'corPrimaria' },
    { rgb: 'rgb(214, 40, 40)', prop: 'backgroundColor', campo: 'corBotao' },
    { rgb: 'rgb(214, 40, 40)', prop: 'color', campo: 'corBotao' },
    { rgb: 'rgb(242, 183, 5)', prop: 'backgroundColor', campo: 'corSecundaria' },
    { rgb: 'rgb(255, 246, 214)', prop: 'backgroundColor', campo: 'corFundo' },
    { rgb: 'rgb(29, 16, 9)', prop: 'color', campo: 'corTexto' },
    { rgb: 'rgb(255, 255, 255)', prop: 'backgroundColor', campo: 'corCard' },
    // Acento do painel Admin (aba ativa do menu, botões primários, valores em
    // destaque) — rgb(217,119,6) = #D97706. Só os usos de "cor de ação",
    // nunca os de "cor categórica" (status de mesa, forma de pagamento, tipo
    // de pedido, dots de KPI) — esses foram trocados no HTML pra uma cor
    // reservada (#CC8400) que não bate aqui de propósito, senão a troca de
    // marca ia misturar as duas coisas (ver Bel do Frango - Admin.dc.html).
    { rgb: 'rgb(217, 119, 6)', prop: 'backgroundColor', campo: 'corBotao' },
    { rgb: 'rgb(217, 119, 6)', prop: 'color', campo: 'corBotao' },
    { rgb: 'rgb(217, 119, 6)', prop: 'borderColor', campo: 'corBotao' },
  ];

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

  /** Usado pelo listener de preview (Task 5) — aplica as
   * vars direto no documentElement, sem esperar um novo <style>. */
  function aplicarCssVarsDireto(branding) {
    var root = document.documentElement.style;
    Object.keys(CAMPOS_CSS_VAR).forEach(function (campo) {
      if (branding[campo]) root.setProperty(CAMPOS_CSS_VAR[campo], branding[campo]);
    });
  }

  // Mesma regra de apiBase usada em todos os outros arquivos (index.html,
  // Admin.dc.html etc.) — em dev o front roda numa porta separada (5000) da
  // API (3010), não dá pra usar caminho relativo.
  var isDevLocal = (location.hostname === 'localhost' || location.hostname === '127.0.0.1');
  var API_BASE = isDevLocal ? 'http://localhost:3010/api' : '/api';

  // Dev não tem subdomínio de verdade — sem isso, todo arquivo sempre mostra
  // o TENANT_DEV_PADRAO do backend. Só funciona em localhost e só se a URL
  // tiver ?_tenant=slug (usado pelo link "Abrir loja" do super.html).
  var tenantDev = isDevLocal ? new URLSearchParams(location.search).get('_tenant') : null;
  var headersConfig = tenantDev ? { 'x-tenant-slug': tenantDev } : {};

  var configPromise = fetch(API_BASE + '/config', { headers: headersConfig })
    .then(function (r) { return r.ok ? r.json() : null; })
    .catch(function () { return null; });

  function injetarFonte(nomeFonte) {
    if (!nomeFonte || nomeFonte === 'Verdana' || !GOOGLE_FONTS[nomeFonte]) return;
    if (document.querySelector('link[data-bf-tema-fonte="' + nomeFonte + '"]')) return;
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=' + GOOGLE_FONTS[nomeFonte] + '&display=swap';
    link.setAttribute('data-bf-tema-fonte', nomeFonte);
    document.head.appendChild(link);
  }

  // !important necessário: o runtime do DC (helmet.compile em support.js)
  // re-anexa o <style> estático original (com a cor padrão do Bel do Frango)
  // no <head> a cada render — como isso acontece DEPOIS do tema.js injetar
  // este <style>, um body{color:...} sem !important perde a cascata (mesma
  // especificidade, o que veio depois vence). background não sofria porque
  // o <style> estático nunca definia background, só color — sem concorrência.
  function montarCssBase(branding, features) {
    var linhas = [montarCssVarsRoot(branding)];
    linhas.push('body{background:' + (branding.corFundo || '') + ' !important;color:' + (branding.corTexto || '') + ' !important}');
    if (branding.fonteTexto) {
      linhas.push("body{font-family:'" + branding.fonteTexto + "',system-ui,sans-serif !important}");
    }
    if (branding.fonteTitulo) {
      linhas.push("[style*=\"Bricolage Grotesque\"]{font-family:'" + branding.fonteTitulo + "',sans-serif !important}");
    }
    if (features) {
      Object.keys(features).forEach(function (chave) {
        if (features[chave] === false) {
          linhas.push('[data-feature="' + chave + '"]{display:none !important}');
        }
      });
    }
    return linhas.join('\n');
  }

  function aplicarCssBase(config) {
    var style = document.createElement('style');
    style.id = 'bf-tema-tenant';
    style.textContent = montarCssBase(config.branding, config.features);
    document.head.appendChild(style);
    injetarFonte(config.branding.fonteTitulo);
    if (config.branding.fonteTexto !== config.branding.fonteTitulo) injetarFonte(config.branding.fonteTexto);
  }

  // Tudo abaixo é idempotente de propósito — chamado repetidamente pelo poll
  // até o DC runtime terminar de montar a árvore real. Já trocado não dá
  // match de novo (ou já é o valor novo), então repetir não tem efeito colateral.

  function kebab(prop) {
    return prop.replace(/[A-Z]/g, function (c) { return '-' + c.toLowerCase(); });
  }

  function aplicarCoresDom(branding) {
    var elementos = document.querySelectorAll('body *');
    elementos.forEach(function (el) {
      var cs = getComputedStyle(el);
      REGRAS_COR.forEach(function (regra) {
        var valor = branding[regra.campo];
        if (!valor || cs[regra.prop] !== regra.rgb) return;
        el.style.setProperty(kebab(regra.prop), valor, 'important');
      });
    });
  }

  // A moldura decorativa atrás do "celular" em telas desktop (fora de
  // Início/Cardápio, que usam layout wide) é um radial-gradient fixo — não
  // está nas REGRAS_COR porque gradiente não reduz a um rgb() único pra
  // comparar. Detecta pelo backgroundImage conter "gradient" (o layout wide
  // usa cor sólida) e recria o mesmo gradiente com a cor primária do tenant.
  function escurecer(hex, fator) {
    var m = /^#([0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return hex;
    var n = parseInt(m[1], 16);
    var r = Math.round(((n >> 16) & 255) * fator);
    var g = Math.round(((n >> 8) & 255) * fator);
    var b = Math.round((n & 255) * fator);
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  function aplicarBackdropDesktop(branding) {
    var el = document.querySelector('[data-bf-app-root]');
    if (!el || !branding.corPrimaria) return;
    if (getComputedStyle(el).backgroundImage.indexOf('gradient') === -1) return;
    var escuro = escurecer(branding.corPrimaria, 0.35);
    el.style.setProperty(
      'background',
      'radial-gradient(900px 520px at 50% 0%, ' + branding.corPrimaria + ' 0%, ' + escuro + ' 55%, #000 130%)',
      'important',
    );
  }

  function aplicarNomeELogo(config) {
    var nome = config.tenant && config.tenant.nome;
    var logoUrl = config.branding && config.branding.logoUrl;
    if (nome) {
      document.querySelectorAll('*').forEach(function (el) {
        if (el.children.length === 0 && el.textContent && el.textContent.trim() === 'Bel do Frango') {
          el.textContent = nome;
        }
      });
      // Título da aba (<title>) é string composta ("Entregas — Bel do Frango",
      // "Garçom — Bel do Frango" etc.) — nunca bate no match exato acima, por
      // isso fica de fora do loop e troca por substring aqui.
      if (document.title.indexOf('Bel do Frango') !== -1) {
        document.title = document.title.replace('Bel do Frango', nome);
      }
    }
    if (logoUrl) {
      // Em dev a checagem de posse de /uploads/:tenantId resolve o tenant por
      // header — que uma tag <img> não manda. Sem o ?_tenant= a logo de
      // qualquer tenant fora do TENANT_DEV_PADRAO dá 404 (mesma convenção do
      // uploadsUrl do super.html e do resolveTenant do backend).
      var logoAbsoluta = API_BASE.replace('/api', '') + logoUrl +
        (tenantDev ? '?_tenant=' + encodeURIComponent(tenantDev) : '');
      document.querySelectorAll('img[src*="logo tranparente.png"], img[src*="logo-full.png"]').forEach(function (img) {
        if (img.src !== logoAbsoluta) img.src = logoAbsoluta;
      });
    }
  }

  // Poll de tempo fixo (janela curta após o load) não é suficiente: as telas
  // logado/deslogado (<sc-if>) só montam a árvore real de cada uma quando o
  // usuário troca de estado (ex: só depois de efetivamente logar) — e digitar
  // e-mail/senha rotineiramente leva mais que a janela do poll, então o
  // sidebar do painel (que só existe após o login) nunca era alcançado.
  // MutationObserver reaplica sempre que o DOM muda, sem prazo de validade —
  // disconnect/observe em volta da aplicação evita a mutação que a própria
  // função causa virar um novo evento (loop infinito).
  function iniciarPollDom(config) {
    function aplicarTudo() {
      observer.disconnect();
      aplicarCoresDom(config.branding);
      aplicarBackdropDesktop(config.branding);
      aplicarNomeELogo(config);
      observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    }
    var debounceId = null;
    var observer = new MutationObserver(function () {
      clearTimeout(debounceId);
      debounceId = setTimeout(aplicarTudo, 50);
    });
    aplicarTudo();
  }

  configPromise.then(function (config) {
    if (!config || !config.branding) return;
    aplicarCssBase(config);
    iniciarPollDom(config);
  });
})();

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
  ];

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

  // body{} e a fonte de título são seguros via CSS puro: body{} não tem
  // style inline (só o <style> de bloco, mesma especificidade, cascata
  // normal decide); a fonte usa substring do NOME (não é cor, não sofre a
  // normalização rgb()) então o seletor de atributo funciona igual.
  function montarCssBase(branding, features) {
    var linhas = [];
    linhas.push('body{background:' + (branding.corFundo || '') + ';color:' + (branding.corTexto || '') + '}');
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

  function aplicarCoresDom(branding) {
    var elementos = document.querySelectorAll('body *');
    elementos.forEach(function (el) {
      var cs = getComputedStyle(el);
      REGRAS_COR.forEach(function (regra) {
        var valor = branding[regra.campo];
        if (!valor || cs[regra.prop] !== regra.rgb) return;
        var propCss = regra.prop === 'backgroundColor' ? 'background-color' : 'color';
        el.style.setProperty(propCss, valor, 'important');
      });
    });
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

  function iniciarPollDom(config) {
    var tentativas = 0;
    var MAX_TENTATIVAS = 30; // ~9s a 300ms — dá folga pro CDN do React carregar em conexão lenta
    var id = setInterval(function () {
      tentativas++;
      aplicarCoresDom(config.branding);
      aplicarNomeELogo(config);
      if (tentativas >= MAX_TENTATIVAS) clearInterval(id);
    }, 300);
  }

  configPromise.then(function (config) {
    if (!config || !config.branding) return;
    aplicarCssBase(config);
    iniciarPollDom(config);
  });
})();

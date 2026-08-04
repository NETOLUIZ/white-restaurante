const { corValida } = require('./contraste');

// Lista curada — Atkinson Hyperlegible foi desenhada pelo Braille Institute
// pra baixa visão, boa opção default pra este projeto (acessibilidade é
// decisão de projeto aqui, não só do frontend do tenant).
const FONTES_PERMITIDAS = new Set([
  'Inter', 'Roboto', 'Open Sans', 'Lato', 'Source Sans 3', 'Nunito Sans', 'Atkinson Hyperlegible', 'Verdana',
]);

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

class ErroValidacaoBranding extends Error {}

/**
 * Monta o objeto `data` pro update do TenantBranding a partir do body —
 * valida cor (hex de 6 dígitos) e fonte (lista curada) campo a campo, só
 * inclui o que veio no body (PATCH parcial). Lança ErroValidacaoBranding
 * (400) se algo for inválido — nunca por causa de contraste, isso nunca
 * bloqueia o save, só é informado de volta pro caller calcular.
 */
function montarDadosBranding(body) {
  const data = {};
  for (const campo of CAMPOS_COR) {
    if (body[campo] !== undefined) {
      if (!corValida(body[campo])) {
        throw new ErroValidacaoBranding(`${campo} precisa ser um hex de 6 dígitos (ex: #C8102E)`);
      }
      data[campo] = body[campo];
    }
  }
  for (const campo of CAMPOS_FONTE) {
    if (body[campo] !== undefined) {
      if (!FONTES_PERMITIDAS.has(body[campo])) {
        throw new ErroValidacaoBranding(`${campo} precisa ser uma das fontes permitidas: ${[...FONTES_PERMITIDAS].join(', ')}`);
      }
      data[campo] = body[campo];
    }
  }
  if (body[CAMPO_RAIO] !== undefined) {
    if (!RAIO_REGEX.test(body[CAMPO_RAIO])) {
      throw new ErroValidacaoBranding(`${CAMPO_RAIO} precisa ser um comprimento CSS válido (ex: 8px ou 0.5rem)`);
    }
    data[CAMPO_RAIO] = body[CAMPO_RAIO];
  }
  return data;
}

/** Os campos de logo/favicon salvos no banco são caminhos relativos (ver utils/upload.js) — isso monta a URL servível. */
function comUrlsCompletas(branding) {
  return {
    ...branding,
    logoUrl: branding.logoUrl ? `/uploads/${branding.logoUrl}` : null,
    faviconUrl: branding.faviconUrl ? `/uploads/${branding.faviconUrl}` : null,
  };
}

module.exports = { montarDadosBranding, ErroValidacaoBranding, FONTES_PERMITIDAS, comUrlsCompletas };

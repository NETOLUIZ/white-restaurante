const HEX_REGEX = /^#[0-9A-Fa-f]{6}$/;

/** Valida hex de 6 dígitos (#RRGGBB) — rejeita hex de 3 dígitos, nomes de cor, rgb(), etc. */
function corValida(hex) {
  return typeof hex === 'string' && HEX_REGEX.test(hex);
}

function hexParaRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

/** Luminância relativa (WCAG 2.2, https://www.w3.org/TR/WCAG22/#dfn-relative-luminance). */
function luminanciaRelativa({ r, g, b }) {
  const [rs, gs, bs] = [r, g, b].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/** Razão de contraste WCAG 2.2 entre duas cores hex — de 1 (idêntico) a 21 (preto/branco). */
function razaoContraste(hexA, hexB) {
  const lA = luminanciaRelativa(hexParaRgb(hexA));
  const lB = luminanciaRelativa(hexParaRgb(hexB));
  const [claro, escuro] = lA > lB ? [lA, lB] : [lB, lA];
  return Number((((claro + 0.05) / (escuro + 0.05))).toFixed(1));
}

const LIMIAR_AA_TEXTO_NORMAL = 4.5;

/**
 * Calcula o contraste dos pares de cor relevantes de um branding. Nunca
 * bloqueia o save — só informa. `aviso` lista os pares abaixo de 4.5:1 (AA
 * pra texto normal, WCAG 2.2).
 */
function calcularContrasteBranding(branding) {
  const botao = razaoContraste(branding.corBotao, branding.corTextoBotao);
  const texto = razaoContraste(branding.corFundo, branding.corTexto);
  const aviso = [];
  if (botao < LIMIAR_AA_TEXTO_NORMAL) aviso.push('botao');
  if (texto < LIMIAR_AA_TEXTO_NORMAL) aviso.push('texto');
  return { botao, texto, aviso };
}

module.exports = { corValida, razaoContraste, calcularContrasteBranding };

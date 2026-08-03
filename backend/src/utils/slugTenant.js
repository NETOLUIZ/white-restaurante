// Compartilhado entre scripts/criar-tenant.js e superTenantController.js —
// as duas formas de subir um tenant novo (linha de comando e painel do
// super admin) precisam validar o slug exatamente da mesma forma.
const SLUGS_RESERVADOS = new Set(['super', 'www', 'api', 'admin', 'app']);
const SLUG_REGEX = /^[a-z0-9-]+$/;

/** Lança Error com mensagem amigável se o slug for inválido ou reservado. */
function validarSlug(slug) {
  if (!slug || !SLUG_REGEX.test(slug)) {
    throw new Error('slug inválido — use só minúsculas, números e hífen (ex: "nova-loja")');
  }
  if (SLUGS_RESERVADOS.has(slug)) {
    throw new Error(`slug "${slug}" é reservado (${[...SLUGS_RESERVADOS].join(', ')})`);
  }
}

module.exports = { validarSlug, SLUGS_RESERVADOS, SLUG_REGEX };

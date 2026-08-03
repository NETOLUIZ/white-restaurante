const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');

const TIPOS_PERMITIDOS = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

/**
 * Fábrica de multer diskStorage — evita repetição de config entre produtos e banners.
 * O nome do arquivo é sempre aleatório (hex) para não expor o nome original
 * nem permitir sobrescrever arquivos por adivinhação.
 *
 * Fase 5: destination virou função — cada tenant grava no próprio diretório
 * (uploads/{tenantId}/{subdir}/), nunca numa pasta compartilhada entre
 * clientes. req.tenantId já está disponível aqui porque resolveTenant +
 * autenticarAdmin rodam antes de qualquer rota de upload.
 *
 * Fase 6A: o upload de logo do super admin roda no subdomínio "super"
 * (req.tenantId não existe lá — ver resolveTenant.js) e o tenant alvo vem
 * de req.params.id, não do subdomínio. `resolverTenantId` deixa a fábrica
 * genérica pros dois casos, em vez de duplicar toda a config de multer.
 * @param {string} subdir - subdiretório dentro de uploads/{tenantId}/ (ex: 'produtos', 'banners')
 * @param {(req: any) => string} [resolverTenantId] - de onde tirar o tenantId; default req.tenantId
 */
function criarStorage(subdir, resolverTenantId = (req) => req.tenantId) {
  return multer.diskStorage({
    destination(req, file, cb) {
      const dir = path.join(__dirname, '..', '..', 'uploads', resolverTenantId(req), subdir);
      fs.mkdir(dir, { recursive: true }, (err) => cb(err, dir));
    },
    filename(req, file, cb) {
      const extensao = path.extname(file.originalname).toLowerCase() || '.jpg';
      cb(null, `${crypto.randomBytes(16).toString('hex')}${extensao}`);
    },
  });
}

/** Multer configurado para fotos de produto — salva em uploads/{tenantId}/produtos. */
const uploadFoto = multer({
  storage: criarStorage('produtos'),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter(req, file, cb) {
    if (!TIPOS_PERMITIDOS.has(file.mimetype)) {
      return cb(new Error('Tipo de arquivo não permitido — envie JPG, PNG, WEBP ou GIF'));
    }
    cb(null, true);
  },
});

/** Multer configurado para fotos de banner — salva em uploads/{tenantId}/banners. */
const uploadFotoBanner = multer({
  storage: criarStorage('banners'),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter(req, file, cb) {
    if (!TIPOS_PERMITIDOS.has(file.mimetype)) {
      return cb(new Error('Tipo de arquivo não permitido — envie JPG, PNG, WEBP ou GIF'));
    }
    cb(null, true);
  },
});

/** Multer configurado para fotos de categoria — salva em uploads/{tenantId}/categorias. */
const uploadFotoCategoria = multer({
  storage: criarStorage('categorias'),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter(req, file, cb) {
    if (!TIPOS_PERMITIDOS.has(file.mimetype)) {
      return cb(new Error('Tipo de arquivo não permitido — envie JPG, PNG, WEBP ou GIF'));
    }
    cb(null, true);
  },
});

/**
 * Multer configurado para logo de branding (super admin) — salva em
 * uploads/{tenantId}/branding/. tenantId vem de req.params.id (o tenant
 * alvo, escolhido pelo super admin), não de req.tenantId.
 */
const uploadFotoBranding = multer({
  storage: criarStorage('branding', (req) => req.params.id),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter(req, file, cb) {
    if (!TIPOS_PERMITIDOS.has(file.mimetype)) {
      return cb(new Error('Tipo de arquivo não permitido — envie JPG, PNG, WEBP ou GIF'));
    }
    cb(null, true);
  },
});

/**
 * Multer configurado pra planilha de importação de produtos — fica só em
 * memória (nunca grava em disco): o arquivo é lido uma vez pelo exceljs e
 * descartado, diferente das fotos acima que persistem em uploads/.
 */
const uploadPlanilha = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB — planilha de produtos é texto, não precisa de mais
  fileFilter(req, file, cb) {
    if (!file.originalname.toLowerCase().endsWith('.xlsx')) {
      return cb(new Error('Envie um arquivo .xlsx — baixe a planilha modelo se não tiver uma'));
    }
    cb(null, true);
  },
});

module.exports = { uploadFoto, uploadFotoBanner, uploadFotoCategoria, uploadFotoBranding, uploadPlanilha };

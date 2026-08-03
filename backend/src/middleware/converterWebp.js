const fs = require('fs/promises');
const path = require('path');
const sharp = require('sharp');

/**
 * Roda logo depois de um multer .single(...) — reescreve o arquivo recebido
 * em WebP (qualidade 80) e atualiza req.file pra que os controllers (que só
 * leem req.file.filename) nem percebam a diferença. Gif vira webp animado
 * ({ animated: true }), não só o primeiro frame.
 */
async function converterWebp(req, res, next) {
  if (!req.file) return next();

  try {
    const origem = req.file.path;
    const novoNome = req.file.filename.replace(/\.[^.]+$/, '.webp');
    const destino = path.join(path.dirname(origem), novoNome);
    const animado = req.file.mimetype === 'image/gif';

    await sharp(origem, { animated: animado }).webp({ quality: 80 }).toFile(destino);
    if (destino !== origem) await fs.unlink(origem);

    req.file.filename = novoNome;
    req.file.path = destino;
    req.file.mimetype = 'image/webp';
    next();
  } catch (err) {
    console.error('Erro ao converter imagem para WebP:', err);
    res.status(500).json({ erro: 'Erro ao processar imagem' });
  }
}

module.exports = { converterWebp };

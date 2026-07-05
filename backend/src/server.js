require('dotenv').config();
const path = require('path');

// Bloqueia o boot se o JWT_SECRET estiver ausente, fraco ou for um valor
// padrão conhecido — evita rodar em produção com um segredo previsível.
const JWT_SECRETS_FRACOS = new Set([
  'troque-por-um-segredo-forte',
  'secret',
  'senha',
  'password',
  '123456',
  'changeme',
  'belofrango',
  'beldofrango',
]);
if (
  !process.env.JWT_SECRET ||
  process.env.JWT_SECRET.length < 32 ||
  JWT_SECRETS_FRACOS.has(process.env.JWT_SECRET.toLowerCase())
) {
  console.error('FATAL: JWT_SECRET ausente, fraco ou valor padrão conhecido. Gere com: openssl rand -base64 48');
  process.exit(1);
}

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth');
const categoriasRoutes = require('./routes/categorias');
const subcategoriasRoutes = require('./routes/subcategorias');
const configuracaoRoutes = require('./routes/configuracao');
const produtosRoutes = require('./routes/produtos');
const cuponsRoutes = require('./routes/cupons');
const pedidosRoutes = require('./routes/pedidos');
const bannersRoutes = require('./routes/banners');
const proteinasRoutes = require('./routes/proteinas');
const complementosRoutes = require('./routes/complementos');
const marmitaTamanhosRoutes = require('./routes/marmitaTamanhos');
const adminRoutes = require('./routes/admin');
const garcomRoutes = require('./routes/garcom');
const entregadorRoutes = require('./routes/entregador');
const atendenteRoutes = require('./routes/atendente');

const app = express();
const PORT = process.env.PORT || 3010;

// Confia no primeiro proxy reverso (nginx) em produção, pro rate limit usar
// o IP real do cliente (X-Forwarded-For) em vez do IP do proxy.
app.set('trust proxy', 1);

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'none'"],
        connectSrc: ["'self'"],
        imgSrc: ["'self'", 'data:'],
      },
    },
    // Admin/cliente rodam em origem (porta) diferente da API por design — o
    // padrão 'same-origin' do helmet bloqueia silenciosamente o <img> das
    // fotos de produto vindas de /uploads.
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }),
);

// CORS com origem fixa (single-tenant — só o frontend deste protótipo),
// credentials:true porque o login do admin usa cookie httpOnly.
app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://127.0.0.1:5000',
    credentials: true,
  }),
);

app.use(express.json());
app.use(cookieParser());

// Fotos de produto enviadas pelo admin (multer salva em disco, nunca base64 no banco).
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Rotas públicas que criam pedido/validam cupom sem autenticação — limite
// mais agressivo pra dificultar flood. As demais rotas têm limite geral.
const limitadorPublico = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erro: 'Muitas requisições. Tente novamente em instantes.' },
});
// Login é mais sensível que os outros endpoints públicos (alvo de brute-force
// de senha) — limite por IP bem mais estrito que o resto do tráfego público.
const limitadorLogin = rateLimit({
  windowMs: 60 * 1000,
  max: 4,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erro: 'Muitas tentativas de login. Tente novamente em alguns minutos.' },
});
const limitadorGeral = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erro: 'Muitas requisições. Tente novamente em instantes.' },
});

app.use('/api', limitadorGeral);
app.use('/api/pedidos', limitadorPublico);
app.use('/api/cupons', limitadorPublico);
app.use('/api/auth/login', limitadorLogin);
app.use('/api/garcom/login', limitadorLogin);
app.use('/api/entregador/login', limitadorLogin);
app.use('/api/atendente/login', limitadorLogin);

app.use('/api/auth', authRoutes);
app.use('/api/categorias', categoriasRoutes);
app.use('/api/subcategorias', subcategoriasRoutes);
app.use('/api/configuracao', configuracaoRoutes);
app.use('/api/produtos', produtosRoutes);
app.use('/api/cupons', cuponsRoutes);
app.use('/api/pedidos', pedidosRoutes);
app.use('/api/banners', bannersRoutes);
app.use('/api/proteinas', proteinasRoutes);
app.use('/api/complementos', complementosRoutes);
app.use('/api/marmita-tamanhos', marmitaTamanhosRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/garcom', garcomRoutes);
app.use('/api/entregador', entregadorRoutes);
app.use('/api/atendente', atendenteRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`🍗 Bel do Frango ATU API rodando na porta ${PORT}`);
});

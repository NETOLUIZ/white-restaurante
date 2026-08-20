const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

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

// NODE_ENV precisa ser explicito — sem isso, "secure: NODE_ENV === 'production'"
// nos cookies de sessao (authController e afins) cai silenciosamente pra false
// e a sessao passa a trafegar tambem por HTTP puro em produção.
if (!['development', 'production'].includes(process.env.NODE_ENV)) {
  console.error('FATAL: NODE_ENV ausente ou invalido. Defina NODE_ENV=development ou NODE_ENV=production no .env.');
  process.exit(1);
}

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const multer = require('multer');

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
const bairrosRoutes = require('./routes/bairros');
const adminRoutes = require('./routes/admin');
const garcomRoutes = require('./routes/garcom');
const entregadorRoutes = require('./routes/entregador');
const atendenteRoutes = require('./routes/atendente');
const empresaRoutes = require('./routes/empresa');
const superRoutes = require('./routes/super');
const configRoutes = require('./routes/config');
const pagamentoRoutes = require('./routes/pagamento');
const { resolveTenant } = require('./middleware/resolveTenant');

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

// CORS dinâmico (Fase 5) — aceita qualquer subdomínio direto de DOMINIO_BASE
// (ex: https://belfrango.dominio.com, https://outraloja.dominio.com, e mais
// tarde https://super.dominio.com), sem lista fixa de origem. credentials:true
// porque o login usa cookie httpOnly.
//
// ⚠️ Nunca trocar por `origin: true` nem por refletir a origem recebida sem
// checar contra um padrão — com credentials:true isso vira roubo de sessão
// (qualquer site vira "origem permitida"). O padrão exige exatamente 1 label
// de subdomínio + DOMINIO_BASE, com https — nunca aceita o domínio nu.
const DOMINIO_BASE = process.env.DOMINIO_BASE || '';
const dominioBaseEscapado = DOMINIO_BASE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const origemSubdominioRegex = DOMINIO_BASE ? new RegExp(`^https://[a-z0-9-]+\\.${dominioBaseEscapado}$`) : null;

// Em dev não há subdomínio real — aceita localhost/127.0.0.1 na porta do
// FRONTEND_URL (mesmo par que já era aceito antes da Fase 5, só generalizado
// pro caso de DOMINIO_BASE não estar configurado ainda).
const frontendUrl = process.env.FRONTEND_URL || 'http://127.0.0.1:5000';
function origemPermitidaDev(origin) {
  if (process.env.NODE_ENV !== 'development') return false;
  try {
    const o = new URL(origin);
    const f = new URL(frontendUrl);
    return (o.hostname === 'localhost' || o.hostname === '127.0.0.1') && o.port === f.port;
  } catch {
    return false;
  }
}

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true); // requests sem Origin (curl, health check de infra) — sempre passaram
      if (origemSubdominioRegex && origemSubdominioRegex.test(origin)) return callback(null, true);
      if (origemPermitidaDev(origin)) return callback(null, true);
      callback(new Error('Origem não permitida pelo CORS'));
    },
    credentials: true,
  }),
);

app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// Fotos de produto enviadas pelo admin (multer salva em disco, nunca base64 no
// banco) — Fase 5: uploads/{tenantId}/{produtos,banners,categorias}/, um
// diretório por tenant (ver utils/upload.js). A URL carrega o tenantId
// (/uploads/:tenantId/...), mas isso sozinho não basta: sem validar contra o
// tenant resolvido pelo subdomínio da própria requisição, um tenant poderia
// trocar o id na URL e listar/baixar arquivo de outro cliente. resolveTenant
// roda só neste path (não em todo /uploads) pra decidir quem está pedindo;
// o 404 (não 403) não confirma se o arquivo existe pra quem não deveria ver.
// Exceção: o subdomínio "super" nunca tem req.tenantId (não é um tenant) —
// sem o bypass, o painel do super admin nunca conseguiria mostrar preview de
// logo de tenant nenhum, já que toda comparação de posse falharia sempre.
app.use(
  '/uploads/:tenantId',
  resolveTenant,
  (req, res, next) => {
    if (!req.ehSuperAdmin && req.params.tenantId !== req.tenantId) {
      return res.status(404).json({ erro: 'Não encontrado' });
    }
    next();
  },
  (req, res, next) => express.static(path.join(__dirname, '..', 'uploads', req.params.tenantId))(req, res, next),
);

// Health check é infra, não dado de loja — não passa por resolução de tenant.
// Precisa vir ANTES de app.use('/api', resolveTenant) pra não ser interceptado.
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Resolve o tenant pelo subdomínio (ou header x-tenant-slug em dev) e anexa
// req.tenantId/req.tenant/req.prisma — precisa vir antes de qualquer rate
// limit/rota de API, já que o middleware de auth (Fase 3) depende de
// req.prisma pra buscar o usuário escopado ao tenant certo.
app.use('/api', resolveTenant);

// Fase 6A — separa por completo o mundo do super admin do mundo dos tenants:
// o subdomínio "super" só enxerga /api/super/*, e /api/super/* só é alcançável
// a partir do subdomínio "super" (nem um tenant real com o slug certo no header
// de dev, nem ninguém mais, chega lá por engano). 404 nos dois sentidos — não
// 403 — pra não confirmar pra quem não deveria saber que essas rotas existem.
app.use('/api', (req, res, next) => {
  const acessandoSuper = req.path.startsWith('/super');
  if (Boolean(req.ehSuperAdmin) !== acessandoSuper) {
    return res.status(404).json({ erro: 'Não encontrado' });
  }
  next();
});

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
app.use('/api/empresa/login', limitadorLogin);
app.use('/api/super/login', limitadorLogin);

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
app.use('/api/bairros', bairrosRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/garcom', garcomRoutes);
app.use('/api/entregador', entregadorRoutes);
app.use('/api/atendente', atendenteRoutes);
app.use('/api/empresa', empresaRoutes);
app.use('/api/super', superRoutes);
app.use('/api/config', configRoutes);
app.use('/api/pagamentos', pagamentoRoutes);

// Middleware de erro — precisa vir por último, depois de todas as rotas. Sem
// isso, um erro do multer (arquivo maior que o limite, tipo não permitido)
// nunca chega num controller pra virar um {erro} amigável — cai direto no
// handler padrão do Express, que devolve uma página HTML de erro 500 crua.
// Controllers sempre tratam os próprios erros com try/catch (nunca chamam
// next(err)), então praticamente todo erro que chega aqui veio do multer.
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ erro: 'Arquivo muito grande — o limite é 5MB' });
  }
  if (err && err.message) {
    return res.status(400).json({ erro: err.message });
  }
  console.error('Erro não tratado:', err);
  res.status(500).json({ erro: 'Erro interno do servidor' });
});

// Garante que o Super Admin exista e esteja sincronizado com as credenciais do ambiente no boot
async function garantirSuperAdminInicial() {
  try {
    const { prismaBase } = require('./lib/prismaBase');
    const bcrypt = require('bcryptjs');

    const emailSuper = (process.env.SEED_SUPER_EMAIL || 'super@korentech.com.br').trim().toLowerCase();
    const senhaSuper = process.env.SEED_SUPER_SENHA || 'QZWZhZVKJSvLjinq';

    const senhaHash = await bcrypt.hash(senhaSuper, 12);
    await prismaBase.superAdmin.upsert({
      where: { email: emailSuper },
      update: { senha: senhaHash, ativo: true },
      create: { email: emailSuper, senha: senhaHash, nome: 'Super Admin', ativo: true },
    });

    // Fallback de segurança para super@beldofrango.com
    const senhaFallbackHash = await bcrypt.hash('SuperBelDoFrangoAtu@2026', 12);
    await prismaBase.superAdmin.upsert({
      where: { email: 'super@beldofrango.com' },
      update: { senha: senhaFallbackHash, ativo: true },
      create: { email: 'super@beldofrango.com', senha: senhaFallbackHash, nome: 'Super Admin Fallback', ativo: true },
    });

    console.log(`[BOOT] Super Admin sincronizado: ${emailSuper}`);
  } catch (err) {
    console.error('[BOOT] Erro ao sincronizar Super Admin:', err.message);
  }
}

app.listen(PORT, async () => {
  console.log(`🍗 Bel do Frango ATU API rodando na porta ${PORT}`);
  await garantirSuperAdminInicial();
});

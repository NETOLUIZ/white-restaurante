// Launcher do live-server via API (em vez do CLI) porque o wrapper de linha de
// comando do live-server normaliza "--ignore" com path.join, que no Windows
// troca "/" por "\" e quebra o glob "**/backend/**" (chokidar/anymatch exigem
// separador "/" no padrão, mesmo em paths absolutos do Windows). Sem isso, todo
// upload de foto (gravado em backend/uploads) recarregava a página do Admin.
const liveServer = require('live-server');
const { spawn } = require('child_process');
const path = require('path');

// Inicia automaticamente o servidor Node.js backend (porta 3010)
const backendProcess = spawn('node', [path.join(__dirname, '../backend/src/server.js')], {
  stdio: 'inherit',
  shell: true,
});
backendProcess.on('error', (err) => console.error('[dev-server] Erro ao iniciar backend:', err));

// Atalhos pra fugir da URL gigante com espaço/encoding dos .dc.html
// (ex: /admin em vez de /Bel%20do%20Frango%20-%20Admin.dc.html).
const ALIASES = {
  '/admin': '/Bel do Frango - Admin.dc.html',
  '/sistema': '/Bel do Frango - Sistema.dc.html',
  '/entregador': '/entregador.html',
  '/garcom': '/garcom.html',
  '/empresa': '/empresa.html',
  '/super': '/super.html',
};

liveServer.start({
  port: 5000,
  open: 'index.html',
  ignore: ['**/backend/**'],
  middleware: [(req, res, next) => {
    const [rawPath, query] = req.url.split('?');
    // Navegador costuma normalizar "/admin" -> "/admin/". Não dá pra reescrever
    // internamente: a página fica com URL "/admin/" e os caminhos relativos do
    // .dc.html (ex: "scripts/support.js") passam a resolver contra esse diretório
    // (404). Por isso redireciona pra forma sem barra antes de servir o alias.
    const trimmed = rawPath.length > 1 && rawPath.endsWith('/') ? rawPath.slice(0, -1) : rawPath;
    if (trimmed !== rawPath && ALIASES[trimmed]) {
      res.writeHead(302, { Location: trimmed + (query ? '?' + query : '') });
      return res.end();
    }
    const alias = ALIASES[rawPath];
    if (alias) req.url = encodeURI(alias) + (query ? '?' + query : '');
    next();
  }],
});

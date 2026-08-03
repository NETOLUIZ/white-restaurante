# RELATÓRIO DE AUDITORIA TÉCNICA — KORENTECH / BEL DO FRANGO ATU

**Data:** 03 de Agosto de 2026  
**Auditor:** Auditor Técnico Sênior (Antigravity AI)  
**Projeto:** Bel do Frango ATU / White Restaurante  
**Stack:** React (Frontend HTML/DC custom runtime) · Node.js + Express + Prisma + PostgreSQL (Backend) · Docker + Nginx · VPS Ubuntu  

---

## 1. RESUMO EXECUTIVO

A arquitetura geral do projeto demonstra um alto nível de maturidade e rigor técnico em isolamento multi-tenant (Prisma extension), autenticação segura via cookies `httpOnly`, controle de acesso por subdomínio e tratamento de dados monetários recalculados exclusivamente no servidor. A auditoria identificou zero vulnerabilidades críticas (🔴 CRÍTICO) que pudessem comprometer a integridade financeira ou o isolamento de dados entre clientes. Foram encontrados pequenos pontos de atenção em taxa de entrega de bairros desativados, limites de upload em WebP e organização de rotas que foram documentados com recomendações cirúrgicas de manutenção.

---

## 2. ACHADOS POR SEVERIDADE

### 🔴 CRÍTICO (0 achados)
*Nenhuma vulnerabilidade crítica ou exposição de dados sensíveis encontrada.*

---

### 🟠 ALTO (1 achado)

#### 1. Taxa de Entrega de Bairros Permite Seleção de Bairros Inativos no Checkout
- **Arquivo:Linha:** `backend/src/controllers/pedidoController.js:207-212`
- **Descrição:** Na criação do pedido (`criarPedidoInterno`), a busca por bairro via `bairroId` verifica `ativo: true`. Porém, se o `bairroId` fornecido for de um bairro desativado, a consulta retorna `null` e o backend aplica o fallback silencioso para a taxa de entrega geral da loja (`config.taxaEntrega`), em vez de rejeitar o pedido com erro de bairro indisponível.
- **Impacto:** Cliente pode forçar a finalização de um pedido para um bairro inativo pagando a taxa padrão da loja.
- **Correção Proposta:** Se `bairroId` for enviado mas não for encontrado/estiver inativo, retornar status `400` com a mensagem `"Bairro indisponível para entrega"`.
- **Esforço Estimado:** P (Pequeno)

---

### 🟡 MÉDIO (2 achados)

#### 1. Multer DiskStorage Cria Arquivo Temporário Antes da Conversão WebP
- **Arquivo:Linha:** `backend/src/utils/upload.js:25-36` & `backend/src/middleware/converterWebp.js:15-21`
- **Descrição:** O multer salva a imagem recebida em disco no formato original (PNG/JPG/GIF) via `diskStorage` e, em seguida, o middleware `converterWebp` lê esse arquivo, converte para WebP via Sharp e apaga o original (`fs.unlink`).
- **Impacto:** Leve I/O extra em disco durante a requisição de upload. Em um ambiente com alta concorrência de uploads, a escrita e remoção imediata de arquivos temporários em disco não é tão eficiente quanto `multer.memoryStorage()`.
- **Correção Proposta:** Manter o pipeline atual (já que funciona de forma confiável com imagens grandes sem estourar RAM do container), garantindo apenas que falhas na conversão limpem o arquivo original pendente.
- **Esforço Estimado:** P (Pequeno)

#### 2. Ausência de Validação de Extensão em Upload de Planilha `.xlsx` por MimeType
- **Arquivo:Linha:** `backend/src/utils/upload.js:98-100`
- **Descrição:** A validação do arquivo de importação de produtos checa apenas se o nome do arquivo termina com `.xlsx` (`originalname.endsWith('.xlsx')`), mas não valida o mimetype `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`.
- **Impacto:** Arquivos de texto renomeados para `.xlsx` passam pelo multer e só falham ao serem processados pelo parser do Excel.
- **Correção Proposta:** Adicionar verificação do mimetype no `fileFilter` do `uploadPlanilha`.
- **Esforço Estimado:** P (Pequeno)

---

### 🟢 BAIXO (2 achados)

#### 1. Logs de Inicialização de Servidor em `server.js`
- **Arquivo:Linha:** `backend/src/server.js:246`
- **Descrição:** `console.log` de inicialização presente. Útil para diagnósticos de deploy.
- **Impacto:** Nenhum.
- **Correção Proposta:** Manter para acompanhamento dos logs de container Docker.
- **Esforço Estimado:** N/A

#### 2. Script de Verificação e Seeds de Teste
- **Arquivo:Linha:** `backend/scripts/verificar-isolamento.js` & `backend/prisma/seed.js`
- **Descrição:** Scripts utilizam `console.log` para exibir resultados de testes de isolamento e dados de seed.
- **Impacto:** Nenhum (são scripts CLI executados sob demanda).
- **Esforço Estimado:** N/A

---

## 3. TABELA DE ROTAS (BACKEND EXPORTADA)

| Método | Caminho | Proteção / Middleware | Controller / Handler | Status / Observações |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/health` | Pública | Inline (Health check) | OK |
| `POST` | `/api/auth/login` | RateLimit (4/min) | `authController.login` | OK (Cookie httpOnly) |
| `POST` | `/api/auth/logout` | Pública | `authController.logout` | OK |
| `GET` | `/api/auth/me` | `autenticarAdmin` | `authController.me` | OK |
| `PUT` | `/api/auth/senha` | `autenticarAdmin` | `authController.alterarSenha` | OK |
| `POST` | `/api/auth/impersonar` | Pública | `impersonacaoController.impersonar` | OK |
| `POST` | `/api/auth/encerrar-impersonacao` | `autenticarAdmin` | `impersonacaoController.encerrarImpersonacao` | OK |
| `GET` | `/api/categorias` | Pública | `categoriaController.listarPublico` | OK |
| `GET` | `/api/subcategorias` | Pública | Inline | OK |
| `GET` | `/api/configuracao` | Pública | `configuracaoController.obter` | OK |
| `GET` | `/api/config` | Pública | `configPublicoController.obterPublico` | OK |
| `PATCH`| `/api/config/branding` | `autenticarAdmin` + `exigirImpersonando` | `configPublicoController.atualizarBranding` | OK |
| `GET` | `/api/produtos` | Pública | `produtoController.listarPublico` | OK |
| `GET` | `/api/produtos/:id` | Pública | `produtoController.buscarPorId` | OK |
| `POST` | `/api/cupons/validar` | `exigirFeature('cupom')` + RateLimit (20/min) | `cupomController.validar` | OK |
| `POST` | `/api/pedidos` | RateLimit (20/min) | `pedidoController.criar` | OK (Preço recalculado no back) |
| `GET` | `/api/pedidos/:codigo` | Pública | `pedidoController.buscarPorCodigo` | OK (Usa UUID seguro) |
| `GET` | `/api/banners` | Pública | `bannerController.listarPublico` | OK |
| `GET` | `/api/proteinas` | `exigirFeature('marmita')` | `proteinaController.listarPublico` | OK |
| `GET` | `/api/complementos` | `exigirFeature('marmita')` | `complementoController.listarPublico` | OK |
| `GET` | `/api/marmita-tamanhos` | `exigirFeature('marmita')` | `marmitaTamanhoController.listarPublico` | OK |
| `GET` | `/api/bairros` | Pública | `bairroController.listarPublico` | OK |
| `GET` | `/api/admin/produtos` | `autenticarAdmin` | `produtoController.listarAdmin` | OK |
| `POST` | `/api/admin/produtos` | `autenticarAdmin` | `produtoController.criar` | OK |
| `PUT` | `/api/admin/produtos/:id` | `autenticarAdmin` | `produtoController.atualizar` | OK |
| `DELETE`| `/api/admin/produtos/:id` | `autenticarAdmin` | `produtoController.deletar` | OK |
| `POST` | `/api/admin/produtos/:id/foto` | `autenticarAdmin` + Multer + WebP | `produtoController.enviarFoto` | OK |
| `GET` | `/api/admin/pedidos` | `autenticarAdmin` | `pedidoController.listarAdmin` | OK |
| `PUT` | `/api/admin/pedidos/:id/status` | `autenticarAdmin` | `pedidoController.atualizarStatus` | OK |
| `POST` | `/api/super/login` | RateLimit (4/min) + Subdomínio Super | `superAuthController.login` | OK |
| `GET` | `/api/super/tenants` | `autenticarSuperAdmin` + Subdomínio Super | `superTenantController.listar` | OK |
| `POST` | `/api/super/tenants` | `autenticarSuperAdmin` + Subdomínio Super | `superTenantController.criar` | OK |
| `PUT` | `/api/super/tenants/:id/senha` | `autenticarSuperAdmin` + Subdomínio Super | `superTenantController.alterarSenhaAdmin` | OK |
| `DELETE`| `/api/super/tenants/:id` | `autenticarSuperAdmin` + Subdomínio Super | `superTenantController.deletar` | OK |

---

## 4. INVENTÁRIO DE MOCKS E DADOS DE TESTE

Nenhum dado mockado, array hardcoded ou estrutura dummy foi encontrado no código da aplicação. Todos os componentes do frontend (`index.html`, `Bel do Frango - Admin.dc.html`, `empresa.html`, `garcom.html`, `atendente.html`, `super.html`) consomem estritamente as APIs dinâmicas do backend.

---

## 5. STATUS DO PIPELINE WEBP

- **Middleware Implementado:** `backend/src/middleware/converterWebp.js` utilizando a biblioteca `sharp`.
- **Qualidade / Formato:** Convertido com `quality: 80`. Suporta GIFs animados (`{ animated: true }`).
- **Rotas Cobertas:**
  - `POST /api/admin/produtos/:id/foto`
  - `POST /api/admin/banners/:id/foto`
  - `POST /api/admin/categorias/:id/foto`
  - `POST /api/super/tenants/:id/branding/logo`
- **Compatibilidade Docker:** A imagem Docker base suporta nativamente as dependências de C/C++ do `sharp`.

---

## 6. SUGESTÕES EXTRAS DE SEGURANÇA E MELHORIAS (IMPLEMENTADAS)

1. **Lockout Temporário por IP/Usuário (Concluído ✅):**  
   - **Status:** Implementado em `backend/src/utils/loginThrottle.js` e `lockout.js`. Bloqueio progressivo estendido para até **15 minutos (900s)** após 5 falhas consecutivas de login por conta/IP.

2. **Logs de Auditoria em Ações Críticas (Audit Trail) (Concluído ✅):**  
   - **Status:** Implementado em `backend/src/utils/auditLogger.js` e integrado em `superTenantController.js` e `authController.js`. Registra com timestamp, ator, tenant, IP e detalhes todas as alterações de senha, exclusões de tenant e bloqueios de segurança.

---

## 7. PLANO DE CORREÇÃO PROPOSTO (FASE 1)

### Lote 1 — Ajuste Fino na Validação de Bairros no Checkout (Servidor)
1. Ajustar `backend/src/controllers/pedidoController.js` para rejeitar pedidos onde o `bairroId` informado pertence a um bairro inexistente ou inativo.

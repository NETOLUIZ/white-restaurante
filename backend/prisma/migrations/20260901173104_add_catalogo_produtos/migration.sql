-- AlterTable
ALTER TABLE "Configuracao" ADD COLUMN     "enderecoLoja" TEXT DEFAULT 'Rua Central, 100 — Centro';

-- AlterTable
ALTER TABLE "Proteina" ADD COLUMN     "tipo" TEXT NOT NULL DEFAULT 'padrao';

-- AlterTable
ALTER TABLE "TenantBranding" ALTER COLUMN "corFundoSecundaria" SET DEFAULT '#F7F7F7',
ALTER COLUMN "corDestaque" SET DEFAULT '#F5A623',
ALTER COLUMN "corSucesso" SET DEFAULT '#16A34A',
ALTER COLUMN "corAlerta" SET DEFAULT '#F59E0B',
ALTER COLUMN "corErro" SET DEFAULT '#DC2626',
ALTER COLUMN "botaoPrimarioBorda" SET DEFAULT '#C8102E',
ALTER COLUMN "botaoSecundarioTexto" SET DEFAULT '#C8102E',
ALTER COLUMN "botaoSecundarioBorda" SET DEFAULT '#C8102E',
ALTER COLUMN "cardCorBorda" SET DEFAULT '#E5E5E5',
ALTER COLUMN "cardCorTitulo" SET DEFAULT '#1A1A1A',
ALTER COLUMN "cardCorTextoSecundario" SET DEFAULT '#6B7280',
ALTER COLUMN "headerFundo" SET DEFAULT '#FFFFFF',
ALTER COLUMN "headerCorSaudacao" SET DEFAULT '#1A1A1A',
ALTER COLUMN "headerCorIconeUsuario" SET DEFAULT '#1A1A1A',
ALTER COLUMN "headerCorLocalizacao" SET DEFAULT '#6B7280',
ALTER COLUMN "headerCorNotificacao" SET DEFAULT '#C8102E',
ALTER COLUMN "navInferiorIconeNormal" SET DEFAULT '#9CA3AF',
ALTER COLUMN "navInferiorIconeAtivo" SET DEFAULT '#C8102E',
ALTER COLUMN "navInferiorTextoNormal" SET DEFAULT '#9CA3AF',
ALTER COLUMN "navInferiorTextoAtivo" SET DEFAULT '#C8102E';

-- CreateTable
CREATE TABLE "ProdutoCatalogo" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "descricaoCurta" TEXT NOT NULL,
    "descricaoCompleta" TEXT NOT NULL,
    "preco" DOUBLE PRECISION,
    "codigoBarras" TEXT,
    "foto" TEXT,
    "tag" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProdutoCatalogo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogoProdutoTenant" (
    "id" SERIAL NOT NULL,
    "catalogoProdutoId" INTEGER NOT NULL,
    "tenantId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CatalogoProdutoTenant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CatalogoProdutoTenant_tenantId_idx" ON "CatalogoProdutoTenant"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogoProdutoTenant_catalogoProdutoId_tenantId_key" ON "CatalogoProdutoTenant"("catalogoProdutoId", "tenantId");

-- AddForeignKey
ALTER TABLE "CatalogoProdutoTenant" ADD CONSTRAINT "CatalogoProdutoTenant_catalogoProdutoId_fkey" FOREIGN KEY ("catalogoProdutoId") REFERENCES "ProdutoCatalogo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogoProdutoTenant" ADD CONSTRAINT "CatalogoProdutoTenant_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

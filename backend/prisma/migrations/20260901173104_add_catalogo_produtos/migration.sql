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

-- CreateTable
CREATE TABLE "SuperAdmin" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "senha" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "senhaAlteradaEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SuperAdmin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantBranding" (
    "id" SERIAL NOT NULL,
    "tenantId" TEXT NOT NULL,
    "logoUrl" TEXT,
    "faviconUrl" TEXT,
    "corPrimaria" TEXT NOT NULL DEFAULT '#C8102E',
    "corSecundaria" TEXT NOT NULL DEFAULT '#F5A623',
    "corBotao" TEXT NOT NULL DEFAULT '#C8102E',
    "corTextoBotao" TEXT NOT NULL DEFAULT '#FFFFFF',
    "corFundo" TEXT NOT NULL DEFAULT '#FFFFFF',
    "corTexto" TEXT NOT NULL DEFAULT '#1A1A1A',
    "corCard" TEXT NOT NULL DEFAULT '#FFFFFF',
    "fonteTitulo" TEXT NOT NULL DEFAULT 'Inter',
    "fonteTexto" TEXT NOT NULL DEFAULT 'Inter',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantBranding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantFeature" (
    "id" SERIAL NOT NULL,
    "tenantId" TEXT NOT NULL,
    "chave" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "TenantFeature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImpersonacaoCodigo" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "superAdminId" INTEGER NOT NULL,
    "tenantId" TEXT NOT NULL,
    "expiraEm" TIMESTAMP(3) NOT NULL,
    "usadoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImpersonacaoCodigo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LogImpersonacao" (
    "id" TEXT NOT NULL,
    "superAdminId" INTEGER NOT NULL,
    "tenantId" TEXT NOT NULL,
    "iniciadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "encerradoEm" TIMESTAMP(3),
    "ip" TEXT,

    CONSTRAINT "LogImpersonacao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SuperAdmin_email_key" ON "SuperAdmin"("email");

-- CreateIndex
CREATE UNIQUE INDEX "TenantBranding_tenantId_key" ON "TenantBranding"("tenantId");

-- CreateIndex
CREATE INDEX "TenantFeature_tenantId_idx" ON "TenantFeature"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "TenantFeature_tenantId_chave_key" ON "TenantFeature"("tenantId", "chave");

-- CreateIndex
CREATE UNIQUE INDEX "ImpersonacaoCodigo_codigo_key" ON "ImpersonacaoCodigo"("codigo");

-- CreateIndex
CREATE INDEX "ImpersonacaoCodigo_tenantId_idx" ON "ImpersonacaoCodigo"("tenantId");

-- CreateIndex
CREATE INDEX "LogImpersonacao_tenantId_idx" ON "LogImpersonacao"("tenantId");

-- AddForeignKey
ALTER TABLE "TenantBranding" ADD CONSTRAINT "TenantBranding_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantFeature" ADD CONSTRAINT "TenantFeature_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImpersonacaoCodigo" ADD CONSTRAINT "ImpersonacaoCodigo_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LogImpersonacao" ADD CONSTRAINT "LogImpersonacao_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Renomeia colunas existentes (preserva os valores já salvos por tenant)
ALTER TABLE "TenantBranding" RENAME COLUMN "corBotao" TO "botaoPrimarioFundo";
ALTER TABLE "TenantBranding" RENAME COLUMN "corTextoBotao" TO "botaoPrimarioTexto";

-- Colunas novas — default = aparência atual do template (não o default genérico
-- do schema.prisma, que só vale pra tenant novo) para não mudar visual de tenant existente.
ALTER TABLE "TenantBranding" ADD COLUMN "corFundoSecundaria" TEXT NOT NULL DEFAULT '#FFF3DC';
ALTER TABLE "TenantBranding" ADD COLUMN "corDestaque" TEXT NOT NULL DEFAULT '#F2B705';
ALTER TABLE "TenantBranding" ADD COLUMN "corSucesso" TEXT NOT NULL DEFAULT '#2D9E60';
ALTER TABLE "TenantBranding" ADD COLUMN "corAlerta" TEXT NOT NULL DEFAULT '#B45309';
ALTER TABLE "TenantBranding" ADD COLUMN "corErro" TEXT NOT NULL DEFAULT '#C0392B';

ALTER TABLE "TenantBranding" ADD COLUMN "botaoPrimarioBorda" TEXT NOT NULL DEFAULT '#D62828';
ALTER TABLE "TenantBranding" ADD COLUMN "botaoSecundarioFundo" TEXT NOT NULL DEFAULT '#FFFFFF';
ALTER TABLE "TenantBranding" ADD COLUMN "botaoSecundarioTexto" TEXT NOT NULL DEFAULT '#D62828';
ALTER TABLE "TenantBranding" ADD COLUMN "botaoSecundarioBorda" TEXT NOT NULL DEFAULT '#D62828';
ALTER TABLE "TenantBranding" ADD COLUMN "botaoDesabilitadoFundo" TEXT NOT NULL DEFAULT '#E5E5E5';
ALTER TABLE "TenantBranding" ADD COLUMN "botaoDesabilitadoTexto" TEXT NOT NULL DEFAULT '#9CA3AF';

ALTER TABLE "TenantBranding" ADD COLUMN "cardCorBorda" TEXT NOT NULL DEFAULT '#F1F1F0';
ALTER TABLE "TenantBranding" ADD COLUMN "cardCorTitulo" TEXT NOT NULL DEFAULT '#B5161C';
ALTER TABLE "TenantBranding" ADD COLUMN "cardCorTextoSecundario" TEXT NOT NULL DEFAULT '#7A6C5D';
ALTER TABLE "TenantBranding" ADD COLUMN "cardCorHover" TEXT NOT NULL DEFAULT '#F5F5F5';
ALTER TABLE "TenantBranding" ADD COLUMN "cardRaioBorda" TEXT NOT NULL DEFAULT '8px';

ALTER TABLE "TenantBranding" ADD COLUMN "headerFundo" TEXT NOT NULL DEFAULT '#F2B705';
ALTER TABLE "TenantBranding" ADD COLUMN "headerCorSaudacao" TEXT NOT NULL DEFAULT '#8A1C12';
ALTER TABLE "TenantBranding" ADD COLUMN "headerCorIconeUsuario" TEXT NOT NULL DEFAULT '#B5161C';
ALTER TABLE "TenantBranding" ADD COLUMN "headerCorLocalizacao" TEXT NOT NULL DEFAULT '#7A1209';
ALTER TABLE "TenantBranding" ADD COLUMN "headerCorNotificacao" TEXT NOT NULL DEFAULT '#B5161C';

ALTER TABLE "TenantBranding" ADD COLUMN "navInferiorFundo" TEXT NOT NULL DEFAULT '#FFFFFF';
ALTER TABLE "TenantBranding" ADD COLUMN "navInferiorIconeNormal" TEXT NOT NULL DEFAULT '#A89A88';
ALTER TABLE "TenantBranding" ADD COLUMN "navInferiorIconeAtivo" TEXT NOT NULL DEFAULT '#D62828';
ALTER TABLE "TenantBranding" ADD COLUMN "navInferiorTextoNormal" TEXT NOT NULL DEFAULT '#A89A88';
ALTER TABLE "TenantBranding" ADD COLUMN "navInferiorTextoAtivo" TEXT NOT NULL DEFAULT '#D62828';

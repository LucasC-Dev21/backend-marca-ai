-- CreateTable
CREATE TABLE "Sessoes" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "encerradoEm" TIMESTAMP(3),
    "expiraEm" TIMESTAMP(3) NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "ip" TEXT,
    "userAgent" TEXT,
    "ultimoAcesso" TIMESTAMP(3),
    "revogadoPor" TEXT,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "Sessoes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Sessoes_token_key" ON "Sessoes"("token");

-- CreateIndex
CREATE UNIQUE INDEX "Sessoes_refreshToken_key" ON "Sessoes"("refreshToken");

-- CreateIndex
CREATE INDEX "Sessoes_tenantId_ativo_idx" ON "Sessoes"("tenantId", "ativo");

-- AddForeignKey
ALTER TABLE "Sessoes" ADD CONSTRAINT "Sessoes_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenants"("tenantId") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "Tenants" (
    "tenantId" TEXT NOT NULL,
    "cnpj" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "sufixo" TEXT NOT NULL,
    "dbName" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tenants_pkey" PRIMARY KEY ("tenantId")
);

-- CreateTable
CREATE TABLE "Usuarios_Redirect" (
    "userId" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "dbName" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Usuarios_Redirect_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenants_cnpj_key" ON "Tenants"("cnpj");

-- CreateIndex
CREATE UNIQUE INDEX "Tenants_email_key" ON "Tenants"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Tenants_sufixo_key" ON "Tenants"("sufixo");

-- CreateIndex
CREATE UNIQUE INDEX "Tenants_dbName_key" ON "Tenants"("dbName");

-- CreateIndex
CREATE UNIQUE INDEX "Tenants_slug_key" ON "Tenants"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Usuarios_Redirect_email_key" ON "Usuarios_Redirect"("email");

-- AddForeignKey
ALTER TABLE "Usuarios_Redirect" ADD CONSTRAINT "Usuarios_Redirect_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenants"("tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

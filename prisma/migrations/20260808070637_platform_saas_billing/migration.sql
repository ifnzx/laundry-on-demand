-- CreateTable
CREATE TABLE "platform_fee_entries" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "yearMonth" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "platform_fee_entries_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "platform_fee_entries_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "platform_invoices" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "platform_invoices" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "yearMonth" TEXT NOT NULL,
    "totalAmount" REAL NOT NULL DEFAULT 0,
    "feeCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'open',
    "dueAt" DATETIME NOT NULL,
    "paidAt" DATETIME,
    "paidNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "platform_fee_entries_orderId_key" ON "platform_fee_entries"("orderId");

-- CreateIndex
CREATE INDEX "platform_fee_entries_yearMonth_idx" ON "platform_fee_entries"("yearMonth");

-- CreateIndex
CREATE UNIQUE INDEX "platform_invoices_yearMonth_key" ON "platform_invoices"("yearMonth");

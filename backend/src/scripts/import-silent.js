require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();
const SRC = path.join(__dirname, '../../../backup/data.json');

async function upsertAll(model, rows) {
  let ok = 0, skip = 0;
  for (const row of rows) {
    try {
      await prisma[model].upsert({ where: { id: row.id }, update: row, create: row });
      ok++;
    } catch { skip++; }
  }
  return { ok, skip };
}

module.exports = async function importSilent() {
  if (!fs.existsSync(SRC)) return;
  const data = JSON.parse(fs.readFileSync(SRC, 'utf8'));
  console.log(`Import từ backup ngày ${data.exportedAt}...`);

  const steps = [
    ['user', data.users], ['category', data.categories], ['supplier', data.suppliers],
    ['customer', data.customers], ['product', data.products], ['salesChannel', data.salesChannels],
    ['order', data.orders], ['orderItem', data.orderItems], ['purchaseOrder', data.purchaseOrders],
    ['purchaseItem', data.purchaseItems], ['stockLog', data.stockLogs], ['expense', data.expenses],
    ['receipt', data.receipts], ['debt', data.debts], ['channelProduct', data.channelProducts],
    ['shift', data.shifts], ['auditLog', data.auditLogs],
  ];

  for (const [model, rows] of steps) {
    if (!rows?.length) continue;
    const { ok, skip } = await upsertAll(model, rows);
    console.log(`  ${model}: ${ok} nhập${skip ? `, ${skip} bỏ qua` : ''}`);
  }
  console.log('✔ Import hoàn tất');
  await prisma.$disconnect();
};

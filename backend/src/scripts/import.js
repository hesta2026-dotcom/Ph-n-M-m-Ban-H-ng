require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();
const SRC = path.join(__dirname, '../../../backup/data.json');

async function upsertAll(model, rows, key = 'id') {
  let ok = 0, skip = 0;
  for (const row of rows) {
    try {
      await prisma[model].upsert({
        where: { [key]: row[key] },
        update: row,
        create: row,
      });
      ok++;
    } catch (e) {
      skip++;
    }
  }
  return { ok, skip };
}

async function main() {
  if (!fs.existsSync(SRC)) {
    console.log('Không tìm thấy file backup/data.json — bỏ qua import.');
    return;
  }

  const data = JSON.parse(fs.readFileSync(SRC, 'utf8'));
  console.log(`Đang import từ backup ngày ${data.exportedAt}...`);

  // Thứ tự import theo dependency (cha trước con)
  const steps = [
    ['user',           data.users],
    ['category',       data.categories],
    ['supplier',       data.suppliers],
    ['customer',       data.customers],
    ['product',        data.products],
    ['salesChannel',   data.salesChannels],
    ['order',          data.orders],
    ['orderItem',      data.orderItems],
    ['purchaseOrder',  data.purchaseOrders],
    ['purchaseItem',   data.purchaseItems],
    ['stockLog',       data.stockLogs],
    ['expense',        data.expenses],
    ['receipt',        data.receipts],
    ['debt',           data.debts],
    ['channelProduct', data.channelProducts],
    ['shift',          data.shifts],
    ['auditLog',       data.auditLogs],
  ];

  for (const [model, rows] of steps) {
    if (!rows || rows.length === 0) continue;
    const { ok, skip } = await upsertAll(model, rows);
    console.log(`  ${model}: ${ok} đã nhập${skip ? `, ${skip} bỏ qua` : ''}`);
  }

  console.log('✔ Import hoàn tất!');
}

main().catch(e => { console.error('Lỗi import:', e.message); process.exit(1); })
      .finally(() => prisma.$disconnect());

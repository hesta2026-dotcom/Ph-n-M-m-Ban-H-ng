require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();
const OUT = path.join(__dirname, '../../../backup/data.json');

async function main() {
  console.log('Đang xuất dữ liệu...');

  const [
    users, categories, suppliers, customers, products,
    salesChannels, orders, orderItems,
    purchaseOrders, purchaseItems,
    stockLogs, expenses, receipts, debts,
    channelProducts, shifts, auditLogs
  ] = await Promise.all([
    prisma.user.findMany(),
    prisma.category.findMany(),
    prisma.supplier.findMany(),
    prisma.customer.findMany(),
    prisma.product.findMany(),
    prisma.salesChannel.findMany(),
    prisma.order.findMany(),
    prisma.orderItem.findMany(),
    prisma.purchaseOrder.findMany(),
    prisma.purchaseItem.findMany(),
    prisma.stockLog.findMany(),
    prisma.expense.findMany(),
    prisma.receipt.findMany(),
    prisma.debt.findMany(),
    prisma.channelProduct.findMany(),
    prisma.shift.findMany(),
    prisma.auditLog.findMany(),
  ]);

  const data = {
    exportedAt: new Date().toISOString(),
    users, categories, suppliers, customers, products,
    salesChannels, orders, orderItems,
    purchaseOrders, purchaseItems,
    stockLogs, expenses, receipts, debts,
    channelProducts, shifts, auditLogs
  };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(data, null, 2), 'utf8');

  console.log(`✔ Đã xuất:`);
  console.log(`  - ${users.length} tài khoản`);
  console.log(`  - ${products.length} sản phẩm`);
  console.log(`  - ${customers.length} khách hàng`);
  console.log(`  - ${orders.length} đơn hàng`);
  console.log(`  - ${suppliers.length} nhà cung cấp`);
  console.log(`  - ${expenses.length} thu chi`);
  console.log(`  - ${debts.length} công nợ`);
  console.log(`Lưu tại: ${OUT}`);
}

main().catch(e => { console.error('Lỗi:', e.message); process.exit(1); })
      .finally(() => prisma.$disconnect());

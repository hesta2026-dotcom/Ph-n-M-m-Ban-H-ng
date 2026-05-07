const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

require('dotenv').config({ path: path.join(__dirname, '.env') });

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'file:./prisma/posdb.db';
}

console.log('DATABASE_URL:', process.env.DATABASE_URL);

try {
  console.log('Running prisma db push...');
  execSync('npx prisma db push --accept-data-loss', {
    stdio: 'inherit', cwd: __dirname, env: process.env
  });
} catch (e) {
  console.error('prisma db push error (continuing):', e.message);
}

async function restoreIfEmpty() {
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  try {
    const productCount = await prisma.product.count();
    if (productCount > 0) {
      console.log(`DB has ${productCount} products - skipping restore`);
      await prisma.$disconnect();
      return;
    }

    const seedFile = path.join(__dirname, 'prisma/seed-data.json');
    if (!fs.existsSync(seedFile)) {
      console.log('No seed-data.json - running basic seed...');
      await prisma.$disconnect();
      execSync('node src/seed.js', { stdio: 'inherit', cwd: __dirname, env: process.env });
      return;
    }

    console.log('DB empty - restoring from seed-data.json...');
    const seed = JSON.parse(fs.readFileSync(seedFile, 'utf8'));
    const bcrypt = require('bcryptjs');

    // 1. Users
    const adminPass = await bcrypt.hash('123456', 10);
    const admin = await prisma.user.upsert({
      where: { email: 'admin@pos.com' },
      update: {},
      create: { name: 'Admin', email: 'admin@pos.com', password: adminPass, role: 'ADMIN', phone: '0900000001' }
    });
    await prisma.user.upsert({
      where: { email: 'staff@pos.com' },
      update: {},
      create: { name: 'Nhân viên 1', email: 'staff@pos.com', password: adminPass, role: 'STAFF', phone: '0900000002' }
    });

    // 2. Categories
    const catMap = {};
    for (const cat of seed.categories) {
      const c = await prisma.category.upsert({
        where: { slug: cat.slug },
        update: {},
        create: { name: cat.name, slug: cat.slug }
      });
      catMap[cat.name] = c.id;
    }
    console.log(`Restored ${seed.categories.length} categories`);

    // 3. Suppliers
    const supMap = {};
    for (const sup of seed.suppliers) {
      const existing = await prisma.supplier.findFirst({ where: { name: sup.name } });
      if (existing) { supMap[sup.name] = existing.id; continue; }
      const s = await prisma.supplier.create({ data: { name: sup.name, phone: sup.phone, email: sup.email, address: sup.address } });
      supMap[sup.name] = s.id;
    }
    console.log(`Restored ${seed.suppliers.length} suppliers`);

    // 4. Products
    const prodCodeMap = {};
    let created = 0;
    const BATCH = 50;
    for (let i = 0; i < seed.products.length; i += BATCH) {
      const batch = seed.products.slice(i, i + BATCH);
      for (const p of batch) {
        try {
          const prod = await prisma.product.create({
            data: {
              code: p.code, name: p.name, barcode: p.barcode || null,
              unit: p.unit || 'cái', packageUnit: p.packageUnit || null,
              packageQty: p.packageQty ? +p.packageQty : null,
              price: +p.price, costPrice: +(p.costPrice || 0),
              stock: +(p.stock || 0), minStock: +(p.minStock || 5),
              brand: p.brand || null, manufacturer: p.manufacturer || null,
              description: p.description || null, isActive: true,
              categoryId: p.categoryName ? (catMap[p.categoryName] || null) : null,
              supplierId: p.supplierName ? (supMap[p.supplierName] || null) : null,
            }
          });
          prodCodeMap[p.code] = prod.id;
          created++;
        } catch {}
      }
    }
    console.log(`Restored ${created}/${seed.products.length} products`);

    // 5. Purchase Orders + Items + Debts
    if (seed.purchases && seed.purchases.length > 0) {
      let poCreated = 0;
      for (const po of seed.purchases) {
        try {
          const supplierId = supMap[po.supplierName];
          if (!supplierId) continue;
          const existing = await prisma.purchaseOrder.findUnique({ where: { code: po.code } });
          if (existing) continue;

          const order = await prisma.purchaseOrder.create({
            data: {
              code: po.code,
              supplierId,
              userId: admin.id,
              status: po.status || 'COMPLETED',
              total: +po.total,
              paid: +(po.paid || 0),
              debt: +(po.debt || 0),
              note: po.note || null,
            }
          });

          for (const item of (po.items || [])) {
            const productId = prodCodeMap[item.productCode];
            if (!productId) continue;
            await prisma.purchaseItem.create({
              data: {
                purchaseOrderId: order.id,
                productId,
                qty: +item.qty,
                costPrice: +item.costPrice,
                total: +item.total,
              }
            });
          }

          // Create debt record if there is outstanding debt
          if (+po.debt > 0) {
            await prisma.debt.create({
              data: {
                type: 'SUPPLIER',
                supplierId,
                orderId: order.id,
                amount: +po.total,
                paid: +(po.paid || 0),
                remaining: +po.debt,
                status: +po.debt === 0 ? 'PAID' : 'UNPAID',
                note: `Phiếu nhập ${po.code}`,
              }
            });
          }
          poCreated++;
        } catch (err) {
          console.error(`PO ${po.code} error:`, err.message);
        }
      }
      console.log(`Restored ${poCreated}/${seed.purchases.length} purchase orders`);
    }

    // 6. Expenses
    if (seed.expenses && seed.expenses.length > 0) {
      let expCreated = 0;
      for (const exp of seed.expenses) {
        try {
          const existing = await prisma.expense.findFirst({ where: { description: exp.description } });
          if (existing) continue;
          await prisma.expense.create({
            data: {
              type: exp.type || 'EXPENSE',
              category: exp.category,
              amount: +exp.amount,
              description: exp.description || null,
              userId: admin.id,
            }
          });
          expCreated++;
        } catch (err) {
          console.error(`Expense error:`, err.message);
        }
      }
      console.log(`Restored ${expCreated}/${seed.expenses.length} expenses`);
    }

    await prisma.$disconnect();
  } catch (e) {
    console.error('Restore error:', e.message);
    await prisma.$disconnect();
  }
}

restoreIfEmpty().then(() => {
  console.log('Starting server...');
  require('./src/index');
}).catch(e => {
  console.error('Fatal:', e.message);
  require('./src/index');
});

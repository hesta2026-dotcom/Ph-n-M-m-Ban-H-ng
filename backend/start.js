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

// Auto-restore from seed-data.json if DB is empty
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

    // 1. Admin user
    const adminPass = await bcrypt.hash('123456', 10);
    await prisma.user.upsert({
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

    // 4. Products in batches of 50
    let created = 0;
    const BATCH = 50;
    for (let i = 0; i < seed.products.length; i += BATCH) {
      const batch = seed.products.slice(i, i + BATCH);
      for (const p of batch) {
        try {
          await prisma.product.create({
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
          created++;
        } catch {}
      }
    }
    console.log(`Restored ${created}/${seed.products.length} products`);
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

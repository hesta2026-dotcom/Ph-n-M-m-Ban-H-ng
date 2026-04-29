require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  const adminPass = await bcrypt.hash('123456', 10);
  const staffPass = await bcrypt.hash('123456', 10);

  await prisma.user.upsert({
    where: { email: 'admin@pos.com' },
    update: {},
    create: { name: 'Admin', email: 'admin@pos.com', password: adminPass, role: 'ADMIN', phone: '0900000001' }
  });

  await prisma.user.upsert({
    where: { email: 'staff@pos.com' },
    update: {},
    create: { name: 'Nhân viên 1', email: 'staff@pos.com', password: staffPass, role: 'STAFF', phone: '0900000002' }
  });

  const cat = await prisma.category.upsert({
    where: { slug: 'hang-hoa-chinh' },
    update: {},
    create: { name: 'Hàng hóa chính', slug: 'hang-hoa-chinh' }
  });

  for (let i = 1; i <= 10; i++) {
    const code = `SP00${i.toString().padStart(3, '0')}`;
    const existing = await prisma.product.findUnique({ where: { code } });
    if (!existing) {
      await prisma.product.create({
        data: { code, name: `Sản phẩm mẫu ${i}`, price: i * 50000, costPrice: i * 30000, stock: 100, categoryId: cat.id, unit: 'cái' }
      });
    }
  }

  console.log('Seed hoàn thành!');
  console.log('Admin: admin@pos.com / 123456');
  console.log('Staff: staff@pos.com / 123456');
}

main().catch(console.error).finally(() => prisma.$disconnect());

const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const auth = require('../middleware/auth');
const prisma = new PrismaClient();

router.get('/', auth, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const [purchases, total] = await Promise.all([
      prisma.purchaseOrder.findMany({ include: { supplier: true, items: { include: { product: true } } }, skip: (page - 1) * limit, take: +limit, orderBy: { createdAt: 'desc' } }),
      prisma.purchaseOrder.count()
    ]);
    res.json({ data: purchases, total });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

router.post('/', auth, async (req, res) => {
  try {
    const { supplierId, items, paid, note } = req.body;
    const total = items.reduce((s, i) => s + i.costPrice * i.qty, 0);
    const debt = total - (paid || 0);
    const code = 'NK' + Date.now();
    const purchase = await prisma.$transaction(async (tx) => {
      const p = await tx.purchaseOrder.create({
        data: { code, supplierId, userId: req.user.id, total, paid: paid || 0, debt, note, status: 'COMPLETED', items: { create: items.map(i => ({ productId: i.productId, qty: i.qty, costPrice: i.costPrice, total: i.costPrice * i.qty })) } },
        include: { items: true }
      });
      for (const item of items) {
        const product = await tx.product.findUnique({ where: { id: item.productId } });
        await tx.product.update({ where: { id: item.productId }, data: { stock: { increment: item.qty }, costPrice: item.costPrice } });
        await tx.stockLog.create({ data: { productId: item.productId, type: 'IMPORT', qty: item.qty, before: product.stock, after: product.stock + item.qty, note: `Nhập kho - ${code}` } });
      }
      if (debt > 0) {
        await tx.supplier.update({ where: { id: supplierId }, data: { debt: { increment: debt } } });
      }
      return p;
    });
    res.status(201).json(purchase);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

module.exports = router;

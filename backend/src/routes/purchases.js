const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const auth = require('../middleware/auth');
const prisma = new PrismaClient();

router.get('/', auth, async (req, res) => {
  try {
    const { page = 1, limit = 200, supplierId, from, to } = req.query;
    const where = { ...(supplierId && { supplierId }), ...(from || to ? { createdAt: { ...(from && { gte: new Date(from + 'T00:00:00+07:00') }), ...(to && { lte: new Date(to + 'T23:59:59+07:00') }) } } : {}) };
    const [purchases, total] = await Promise.all([
      prisma.purchaseOrder.findMany({ where, include: { supplier: true, items: { include: { product: true } } }, skip: (page - 1) * limit, take: +limit, orderBy: { createdAt: 'desc' } }),
      prisma.purchaseOrder.count({ where })
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
      // Luon tao cong no cho phieu nhap
      const debtStatus = (paid || 0) >= total ? 'PAID' : (paid || 0) > 0 ? 'PARTIAL' : 'UNPAID';
      await tx.debt.create({
        data: {
          type: 'SUPPLIER', supplierId,
          amount: total, paid: paid || 0, remaining: Math.max(0, debt),
          status: debtStatus, note: `Phiếu nhập ${code}`
        }
      });
      // Cap nhat du no nha cung cap
      if (debt > 0) {
        await tx.supplier.update({ where: { id: supplierId }, data: { debt: { increment: debt } } });
      }
      // Tao phieu chi neu co thanh toan
      if ((paid || 0) > 0) {
        await tx.expense.create({
          data: {
            type: 'EXPENSE', category: 'Thanh toán nhà cung cấp',
            amount: paid, description: `Thanh toán phiếu nhập ${code}`,
            userId: req.user.id
          }
        });
      }
      return p;
    });
    res.status(201).json(purchase);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const { items, paid, note, supplierId } = req.body;
    const old = await prisma.purchaseOrder.findUnique({ where: { id: req.params.id }, include: { items: true } });
    if (!old) return res.status(404).json({ message: 'Không tìm thấy phiếu nhập' });

    const newTotal = items.reduce((s, i) => s + i.costPrice * i.qty, 0);
    const newDebt = newTotal - (paid ?? old.paid);
    const newPaid = paid ?? old.paid;

    await prisma.$transaction(async (tx) => {
      // Hoàn tồn kho cũ
      for (const item of old.items) {
        await tx.product.update({ where: { id: item.productId }, data: { stock: { decrement: item.qty } } });
      }
      // Xoá items cũ
      await tx.purchaseItem.deleteMany({ where: { purchaseOrderId: old.id } });

      // Cập nhật phiếu
      await tx.purchaseOrder.update({
        where: { id: old.id },
        data: { total: newTotal, paid: newPaid, debt: Math.max(0, newDebt), note, ...(supplierId && { supplierId }),
          items: { create: items.map(i => ({ productId: i.productId, qty: i.qty, costPrice: i.costPrice, total: i.costPrice * i.qty })) }
        }
      });

      // Nhập tồn kho mới
      for (const item of items) {
        const product = await tx.product.findUnique({ where: { id: item.productId } });
        await tx.product.update({ where: { id: item.productId }, data: { stock: { increment: item.qty }, costPrice: item.costPrice } });
        await tx.stockLog.create({ data: { productId: item.productId, type: 'IMPORT', qty: item.qty, before: product.stock, after: product.stock + item.qty, note: `Sửa phiếu nhập - ${old.code}` } });
      }

      // Cập nhật công nợ liên quan
      const debtRec = await tx.debt.findFirst({ where: { note: { contains: old.code } } });
      if (debtRec) {
        const debtStatus = newPaid >= newTotal ? 'PAID' : newPaid > 0 ? 'PARTIAL' : 'UNPAID';
        const remainingDiff = Math.max(0, newDebt) - debtRec.remaining;
        await tx.debt.update({ where: { id: debtRec.id }, data: { amount: newTotal, paid: newPaid, remaining: Math.max(0, newDebt), status: debtStatus } });
        if (remainingDiff !== 0) {
          await tx.supplier.update({ where: { id: old.supplierId }, data: { debt: { increment: remainingDiff } } });
        }
      }
    });

    const updated = await prisma.purchaseOrder.findUnique({ where: { id: old.id }, include: { supplier: true, items: { include: { product: true } } } });
    res.json(updated);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

module.exports = router;

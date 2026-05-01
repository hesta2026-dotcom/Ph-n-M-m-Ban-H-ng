const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const auth = require('../middleware/auth');
const prisma = new PrismaClient();

router.get('/', auth, async (req, res) => {
  try {
    const { type, status, from, to, page = 1, limit = 200 } = req.query;
    const where = { ...(type && { type }), ...(status && { status }), ...(from || to ? { createdAt: { ...(from && { gte: new Date(from) }), ...(to && { lte: new Date(to + 'T23:59:59') }) } } : {}) };
    const [debts, total] = await Promise.all([
      prisma.debt.findMany({ where, include: { customer: true, supplier: true, order: true }, skip: (page - 1) * limit, take: +limit, orderBy: { createdAt: 'desc' } }),
      prisma.debt.count({ where })
    ]);
    res.json({ data: debts, total });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

router.post('/:id/pay', auth, async (req, res) => {
  try {
    const { amount } = req.body;
    const debt = await prisma.debt.findUnique({ where: { id: req.params.id } });
    const newPaid = debt.paid + amount;
    const newRemaining = debt.amount - newPaid;
    const status = newRemaining <= 0 ? 'PAID' : 'PARTIAL';
    const updated = await prisma.debt.update({ where: { id: req.params.id }, data: { paid: newPaid, remaining: newRemaining > 0 ? newRemaining : 0, status } });
    if (debt.type === 'CUSTOMER' && debt.customerId) {
      await prisma.customer.update({ where: { id: debt.customerId }, data: { debt: { decrement: amount } } });
      await prisma.expense.create({ data: { type: 'INCOME', category: 'Thu tiền khách hàng', amount, description: `Thu công nợ - ${debt.note}`, userId: req.user.id } });
    }
    if (debt.type === 'SUPPLIER' && debt.supplierId) {
      await prisma.supplier.update({ where: { id: debt.supplierId }, data: { debt: { decrement: amount } } });
      await prisma.expense.create({ data: { type: 'EXPENSE', category: 'Thanh toán nhà cung cấp', amount, description: `Thanh toán công nợ - ${debt.note}`, userId: req.user.id } });
    }
    res.json(updated);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

module.exports = router;

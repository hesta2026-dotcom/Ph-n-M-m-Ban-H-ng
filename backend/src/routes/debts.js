const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const auth = require('../middleware/auth');
const prisma = new PrismaClient();

router.get('/', auth, async (req, res) => {
  try {
    const { type, status, page = 1, limit = 20 } = req.query;
    const where = { ...(type && { type }), ...(status && { status }) };
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
    }
    res.json(updated);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

module.exports = router;

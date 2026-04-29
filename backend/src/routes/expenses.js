const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const auth = require('../middleware/auth');
const prisma = new PrismaClient();

router.get('/', auth, async (req, res) => {
  try {
    const { type, from, to, page = 1, limit = 20 } = req.query;
    const where = { ...(type && { type }), ...(from || to ? { createdAt: { ...(from && { gte: new Date(from) }), ...(to && { lte: new Date(to) }) } } : {}) };
    const [expenses, total] = await Promise.all([
      prisma.expense.findMany({ where, include: { user: { select: { id: true, name: true } } }, skip: (page - 1) * limit, take: +limit, orderBy: { createdAt: 'desc' } }),
      prisma.expense.count({ where })
    ]);
    res.json({ data: expenses, total });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

router.post('/', auth, async (req, res) => {
  try {
    const expense = await prisma.expense.create({ data: { ...req.body, userId: req.user.id } });
    res.status(201).json(expense);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    await prisma.expense.delete({ where: { id: req.params.id } });
    res.json({ message: 'Đã xóa' });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

module.exports = router;

const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const auth = require('../middleware/auth');
const prisma = new PrismaClient();

router.get('/', auth, async (req, res) => {
  try {
    const { search, page = 1, limit = 20 } = req.query;
    const where = search ? { OR: [{ name: { contains: search, mode: 'insensitive' } }, { phone: { contains: search } }] } : {};
    const [customers, total] = await Promise.all([
      prisma.customer.findMany({ where, skip: (page - 1) * limit, take: +limit, orderBy: { name: 'asc' } }),
      prisma.customer.count({ where })
    ]);
    res.json({ data: customers, total });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

router.post('/', auth, async (req, res) => {
  try {
    const customer = await prisma.customer.create({ data: req.body });
    res.status(201).json(customer);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const customer = await prisma.customer.update({ where: { id: req.params.id }, data: req.body });
    res.json(customer);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

router.get('/:id/orders', auth, async (req, res) => {
  try {
    const orders = await prisma.order.findMany({ where: { customerId: req.params.id }, include: { items: { include: { product: true } } }, orderBy: { createdAt: 'desc' }, take: 20 });
    res.json(orders);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

module.exports = router;

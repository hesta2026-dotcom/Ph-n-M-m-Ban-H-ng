const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const auth = require('../middleware/auth');
const prisma = new PrismaClient();

router.get('/', auth, async (req, res) => {
  try {
    const { search, page = 1, limit = 20 } = req.query;
    const where = search ? { OR: [{ name: { contains: search } }, { phone: { contains: search } }] } : {};
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const validStatus = { notIn: ['CANCELLED', 'REFUNDED'] };

    const [customers, total, monthlyStats, totalStats] = await Promise.all([
      prisma.customer.findMany({ where, skip: (page - 1) * limit, take: +limit, orderBy: { name: 'asc' } }),
      prisma.customer.count({ where }),
      prisma.order.groupBy({
        by: ['customerId'],
        where: { status: validStatus, createdAt: { gte: monthStart }, customerId: { not: null } },
        _count: { id: true },
        _sum: { total: true }
      }),
      prisma.order.groupBy({
        by: ['customerId'],
        where: { status: validStatus, customerId: { not: null } },
        _sum: { total: true }
      })
    ]);

    const monthlyMap = {};
    for (const s of monthlyStats) {
      monthlyMap[s.customerId] = { monthlyCount: s._count.id, monthlyRevenue: s._sum.total || 0 };
    }
    const totalMap = {};
    for (const s of totalStats) {
      totalMap[s.customerId] = s._sum.total || 0;
    }

    const data = customers.map(c => ({
      ...c,
      orderValue: totalMap[c.id] || 0,
      monthlyCount: monthlyMap[c.id]?.monthlyCount || 0,
      monthlyRevenue: monthlyMap[c.id]?.monthlyRevenue || 0
    }));

    res.json({ data, total });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

router.post('/', auth, async (req, res) => {
  try {
    const { phone } = req.body;
    if (phone) {
      const existing = await prisma.customer.findUnique({ where: { phone } });
      if (existing) {
        return res.status(409).json({
          message: 'Số điện thoại đã được đăng ký cho khách hàng khác',
          existing
        });
      }
    }
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

router.delete('/:id', auth, async (req, res) => {
  try {
    await prisma.customer.delete({ where: { id: req.params.id } });
    res.json({ message: 'Đã xóa' });
  } catch (e) { res.status(400).json({ message: 'Không thể xóa khách hàng đang có đơn hàng hoặc công nợ' }); }
});

router.get('/:id/orders', auth, async (req, res) => {
  try {
    const orders = await prisma.order.findMany({ where: { customerId: req.params.id }, include: { items: { include: { product: true } } }, orderBy: { createdAt: 'desc' }, take: 20 });
    res.json(orders);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

module.exports = router;

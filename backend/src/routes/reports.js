const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const auth = require('../middleware/auth');
const prisma = new PrismaClient();

router.get('/dashboard', auth, async (req, res) => {
  try {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);

    const [todayOrders, todayRevenue, totalProducts, lowStock, totalCustomers, recentOrders] = await Promise.all([
      prisma.order.count({ where: { createdAt: { gte: today, lt: tomorrow }, status: 'COMPLETED' } }),
      prisma.order.aggregate({ where: { createdAt: { gte: today, lt: tomorrow }, status: 'COMPLETED' }, _sum: { total: true } }),
      prisma.product.count({ where: { isActive: true } }),
      prisma.product.count({ where: { isActive: true, stock: { lte: 5 } } }),
      prisma.customer.count(),
      prisma.order.findMany({ where: { status: 'COMPLETED' }, include: { customer: true }, orderBy: { createdAt: 'desc' }, take: 5 })
    ]);

    res.json({
      todayOrders,
      todayRevenue: todayRevenue._sum.total || 0,
      totalProducts,
      lowStock,
      totalCustomers,
      recentOrders
    });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

router.get('/revenue', auth, async (req, res) => {
  try {
    const { from, to, groupBy = 'day' } = req.query;
    const where = { status: 'COMPLETED', ...(from && { createdAt: { gte: new Date(from + 'T00:00:00+07:00') } }), ...(to && { createdAt: { lte: new Date(to + 'T23:59:59+07:00') } }) };
    const orders = await prisma.order.findMany({ where, select: { total: true, createdAt: true, channel: true } });
    res.json(orders);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

router.get('/top-products', auth, async (req, res) => {
  try {
    const { from, to, limit = 10 } = req.query;
    const where = { order: { status: 'COMPLETED', ...(from && { createdAt: { gte: new Date(from + 'T00:00:00+07:00') } }), ...(to && { createdAt: { lte: new Date(to + 'T23:59:59+07:00') } }) } };
    const items = await prisma.orderItem.groupBy({ by: ['productId'], where, _sum: { qty: true, total: true }, orderBy: { _sum: { total: 'desc' } }, take: +limit });
    const productIds = items.map(i => i.productId);
    const products = await prisma.product.findMany({ where: { id: { in: productIds } } });
    const result = items.map(i => ({ ...i, product: products.find(p => p.id === i.productId) }));
    res.json(result);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

router.get('/cashflow', auth, async (req, res) => {
  try {
    const { from, to } = req.query;
    const dateFilter = { ...(from && { gte: new Date(from + 'T00:00:00+07:00') }), ...(to && { lte: new Date(to + 'T23:59:59+07:00') }) };
    const [income, expense] = await Promise.all([
      prisma.expense.aggregate({ where: { type: 'INCOME', createdAt: dateFilter }, _sum: { amount: true } }),
      prisma.expense.aggregate({ where: { type: 'EXPENSE', createdAt: dateFilter }, _sum: { amount: true } }),
    ]);
    res.json({ income: income._sum.amount || 0, expense: expense._sum.amount || 0, net: (income._sum.amount || 0) - (expense._sum.amount || 0) });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

router.get('/profit-loss', auth, async (req, res) => {
  try {
    const { from, to } = req.query;
    const now = new Date();
    const _ld = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const fromDate = new Date((from || _ld(new Date(now.getFullYear(), now.getMonth(), 1))) + 'T00:00:00+07:00');
    const toDate = new Date((to || _ld(now)) + 'T23:59:59+07:00');

    const [orders, expenseAgg, incomeAgg] = await Promise.all([
      prisma.order.findMany({
        where: { status: 'COMPLETED', createdAt: { gte: fromDate, lte: toDate } },
        include: { items: { include: { product: { select: { costPrice: true } } } } }
      }),
      prisma.expense.aggregate({
        where: { type: 'EXPENSE', createdAt: { gte: fromDate, lte: toDate } },
        _sum: { amount: true }
      }),
      prisma.expense.aggregate({
        where: { type: 'INCOME', createdAt: { gte: fromDate, lte: toDate } },
        _sum: { amount: true }
      })
    ]);

    let totalRevenue = 0, totalCOGS = 0;
    const dailyMap = {};

    for (const order of orders) {
      const day = order.createdAt.toISOString().slice(0, 10);
      if (!dailyMap[day]) dailyMap[day] = { date: day, revenue: 0, cogs: 0, grossProfit: 0 };
      totalRevenue += order.total;
      dailyMap[day].revenue += order.total;
      for (const item of order.items) {
        const cogs = item.qty * (item.product?.costPrice || 0);
        totalCOGS += cogs;
        dailyMap[day].cogs += cogs;
      }
    }

    for (const d of Object.values(dailyMap)) {
      d.grossProfit = d.revenue - d.cogs;
    }

    const totalExpenses = expenseAgg._sum.amount || 0;
    const otherIncome = incomeAgg._sum.amount || 0;
    const grossProfit = totalRevenue - totalCOGS;
    const netProfit = grossProfit + otherIncome - totalExpenses;

    res.json({
      revenue: totalRevenue,
      cogs: totalCOGS,
      grossProfit,
      expenses: totalExpenses,
      otherIncome,
      netProfit,
      grossMargin: totalRevenue ? (grossProfit / totalRevenue * 100) : 0,
      netMargin: totalRevenue ? (netProfit / totalRevenue * 100) : 0,
      daily: Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date))
    });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

module.exports = router;

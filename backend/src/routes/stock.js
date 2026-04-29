const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const auth = require('../middleware/auth');
const prisma = new PrismaClient();

router.get('/logs', auth, async (req, res) => {
  try {
    const { productId, type, page = 1, limit = 20 } = req.query;
    const where = { ...(productId && { productId }), ...(type && { type }) };
    const logs = await prisma.stockLog.findMany({ where, include: { product: true }, skip: (page - 1) * limit, take: +limit, orderBy: { createdAt: 'desc' } });
    res.json(logs);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

router.get('/low', auth, async (req, res) => {
  try {
    const products = await prisma.product.findMany({ where: { isActive: true, stock: { lte: 10 } }, orderBy: { stock: 'asc' } });
    res.json(products);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

router.post('/adjust', auth, async (req, res) => {
  try {
    const { productId, newStock, note } = req.body;
    const product = await prisma.product.findUnique({ where: { id: productId } });
    const diff = newStock - product.stock;
    await prisma.product.update({ where: { id: productId }, data: { stock: newStock } });
    await prisma.stockLog.create({ data: { productId, type: 'ADJUST', qty: Math.abs(diff), before: product.stock, after: newStock, note } });
    res.json({ message: 'Đã điều chỉnh tồn kho' });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

module.exports = router;

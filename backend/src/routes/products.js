const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const auth = require('../middleware/auth');
const prisma = new PrismaClient();

router.get('/', auth, async (req, res) => {
  try {
    const { search, categoryId, supplierId, lowStock, page = 1, limit = 20 } = req.query;
    const where = { isActive: true };
    if (search) where.OR = [{ name: { contains: search, mode: 'insensitive' } }, { code: { contains: search, mode: 'insensitive' } }, { barcode: { contains: search, mode: 'insensitive' } }];
    if (categoryId) where.categoryId = categoryId;
    if (supplierId) where.supplierId = supplierId;
    if (lowStock === 'true') where.stock = { lte: prisma.product.fields.minStock };
    const [products, total] = await Promise.all([
      prisma.product.findMany({ where, include: { category: true, supplier: true }, skip: (page - 1) * limit, take: +limit, orderBy: { name: 'asc' } }),
      prisma.product.count({ where })
    ]);
    res.json({ data: products, total, page: +page, limit: +limit });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const product = await prisma.product.findUnique({ where: { id: req.params.id }, include: { category: true, supplier: true, stockLogs: { take: 10, orderBy: { createdAt: 'desc' } } } });
    if (!product) return res.status(404).json({ message: 'Không tìm thấy sản phẩm' });
    res.json(product);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

router.post('/', auth, async (req, res) => {
  try {
    const product = await prisma.product.create({ data: req.body });
    res.status(201).json(product);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const old = await prisma.product.findUnique({ where: { id: req.params.id } });
    const product = await prisma.product.update({ where: { id: req.params.id }, data: req.body });
    await prisma.auditLog.create({ data: { userId: req.user.id, action: 'UPDATE', entity: 'Product', entityId: product.id, oldData: old, newData: product } });
    res.json(product);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    await prisma.product.update({ where: { id: req.params.id }, data: { isActive: false } });
    res.json({ message: 'Đã xóa sản phẩm' });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

module.exports = router;

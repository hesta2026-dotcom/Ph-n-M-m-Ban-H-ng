const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const auth = require('../middleware/auth');
const prisma = new PrismaClient();

router.get('/logs', auth, async (req, res) => {
  try {
    const { productId, type, from, to, page = 1, limit = 200 } = req.query;
    const where = { ...(productId && { productId }), ...(type && { type }), ...(from || to ? { createdAt: { ...(from && { gte: new Date(from + 'T00:00:00+07:00') }), ...(to && { lte: new Date(to + 'T23:59:59+07:00') }) } } : {}) };
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

// ── Gợi ý nhập hàng ──
// Tiêu chí: tồn kho < mức bán trung bình × 10 ngày
router.get('/suggestions', auth, async (req, res) => {
  try {
    const DAYS = 30; // lấy dữ liệu 30 ngày gần nhất để tính trung bình
    const TARGET_DAYS = 10; // tồn kho chuẩn = 10 ngày bán
    const since = new Date();
    since.setDate(since.getDate() - DAYS);

    // Tổng số lượng bán từng sản phẩm trong 30 ngày (đơn COMPLETED)
    const soldRaw = await prisma.orderItem.groupBy({
      by: ['productId'],
      where: { order: { status: 'COMPLETED', createdAt: { gte: since } } },
      _sum: { qty: true }
    });
    const soldMap = Object.fromEntries(soldRaw.map(r => [r.productId, r._sum.qty || 0]));

    const products = await prisma.product.findMany({
      where: { isActive: true },
      include: { supplier: true }
    });

    const suggestions = [];
    for (const p of products) {
      const totalSold = soldMap[p.id] || 0;
      const dailyAvg = totalSold / DAYS;
      const targetStock = Math.ceil(dailyAvg * TARGET_DAYS);
      const suggestedQty = Math.max(0, targetStock - p.stock);

      // Chỉ đưa vào gợi ý nếu cần nhập thêm
      if (suggestedQty <= 0 && p.stock > p.minStock) continue;

      const daysRemaining = dailyAvg > 0 ? p.stock / dailyAvg : (p.stock <= p.minStock ? 0 : 999);

      // Làm tròn lên theo quy cách đóng gói
      let suggestedBoxes = null, suggestedRem = suggestedQty;
      if (p.packageQty && p.packageQty > 0) {
        suggestedBoxes = Math.floor(suggestedQty / p.packageQty);
        suggestedRem = suggestedQty % p.packageQty;
      }

      // Giá trị tồn kho & gợi ý: giá vốn tính theo thùng → value = (qty / packageQty) * costPrice
      const stockValue = p.packageQty > 0
        ? (p.stock / p.packageQty) * p.costPrice
        : p.stock * p.costPrice;
      const suggestedValue = p.packageQty > 0
        ? (suggestedQty / p.packageQty) * p.costPrice
        : suggestedQty * p.costPrice;

      suggestions.push({
        id: p.id, name: p.name, code: p.code, unit: p.unit,
        packageUnit: p.packageUnit, packageQty: p.packageQty,
        stock: p.stock, minStock: p.minStock,
        costPrice: p.costPrice, stockValue, suggestedValue,
        supplierId: p.supplierId, supplierName: p.supplier?.name || null,
        dailyAvg: Math.round(dailyAvg * 100) / 100,
        totalSold, daysRemaining: Math.round(daysRemaining * 10) / 10,
        targetStock, suggestedQty,
        suggestedBoxes, suggestedRem
      });
    }

    // Sắp xếp: hàng sắp hết trước (daysRemaining tăng dần)
    suggestions.sort((a, b) => a.daysRemaining - b.daysRemaining);
    res.json(suggestions);
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

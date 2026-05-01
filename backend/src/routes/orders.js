const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const auth = require('../middleware/auth');
const prisma = new PrismaClient();

router.get('/', auth, async (req, res) => {
  try {
    const { from, to, status, channel, page = 1, limit = 20, search } = req.query;
    const where = {};
    if (status) where.status = status;
    if (channel) where.channel = channel;
    if (from || to) where.createdAt = { ...(from && { gte: new Date(from) }), ...(to && { lte: new Date(to) }) };
    if (search) where.orderCode = { contains: search };
    const [orders, total] = await Promise.all([
      prisma.order.findMany({ where, include: { customer: true, user: { select: { id: true, name: true } }, items: { include: { product: true } } }, skip: (page - 1) * limit, take: +limit, orderBy: { createdAt: 'desc' } }),
      prisma.order.count({ where })
    ]);
    res.json({ data: orders, total, page: +page, limit: +limit });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

router.post('/', auth, async (req, res) => {
  try {
    const { customerId, items, paymentMethod, discount, tax, note, channel, amountPaid, status = 'COMPLETED' } = req.body;
    const subtotal = items.reduce((s, i) => s + i.price * i.qty - (i.discount || 0), 0);
    const total = subtotal - (discount || 0) + (tax || 0);
    const change = (amountPaid || 0) - total;

    const orderCode = 'DH' + Date.now();
    const order = await prisma.$transaction(async (tx) => {
      const o = await tx.order.create({
        data: {
          orderCode, customerId, userId: req.user.id, paymentMethod,
          subtotal, discount: discount || 0, tax: tax || 0, total,
          amountPaid: amountPaid || 0, change: change > 0 ? change : 0,
          note, channel: channel || 'store', status,
          items: { create: items.map(i => ({ productId: i.productId, qty: i.qty, price: i.price, discount: i.discount || 0, total: i.price * i.qty - (i.discount || 0), unit: i.unit || 'cái' })) }
        },
        include: { items: true, customer: true }
      });

      if (status === 'COMPLETED') {
        for (const item of items) {
          const product = await tx.product.findUnique({ where: { id: item.productId } });
          await tx.product.update({ where: { id: item.productId }, data: { stock: { decrement: item.qty } } });
          await tx.stockLog.create({ data: { productId: item.productId, type: 'EXPORT', qty: item.qty, before: product.stock, after: product.stock - item.qty, note: `Bán hàng - ${orderCode}` } });
        }
        if (customerId) {
          await tx.customer.update({ where: { id: customerId }, data: { totalSpent: { increment: total }, points: { increment: Math.floor(total / 1000) } } });
        }
        // Tạo công nợ phải thu - luôn UNPAID, chờ xác nhận thủ công
        if (customerId) {
          await tx.debt.create({
            data: {
              type: 'CUSTOMER', customerId, orderId: o.id,
              amount: total, paid: 0, remaining: total,
              status: 'UNPAID',
              note: `Đơn hàng ${orderCode}`
            }
          });
        }
      }

      return o;
    });

    req.app.get('io').emit('order:new', order);
    res.status(201).json(order);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const order = await prisma.order.findUnique({ where: { id: req.params.id }, include: { customer: true, user: { select: { id: true, name: true } }, items: { include: { product: true } } } });
    if (!order) return res.status(404).json({ message: 'Không tìm thấy đơn hàng' });
    res.json(order);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

router.patch('/:id/cancel', auth, async (req, res) => {
  try {
    const order = await prisma.order.update({ where: { id: req.params.id }, data: { status: 'CANCELLED' } });
    await prisma.auditLog.create({ data: { userId: req.user.id, action: 'CANCEL_ORDER', entity: 'Order', entityId: order.id } });
    res.json(order);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

router.patch('/:id/status', auth, async (req, res) => {
  try {
    const { status } = req.body;
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: { items: { include: { product: true } } }
    });
    if (!order) return res.status(404).json({ message: 'Không tìm thấy đơn hàng' });

    const allowed = { PENDING: ['COMPLETED', 'CANCELLED'], COMPLETED: ['REFUNDED', 'CANCELLED'], CANCELLED: [], REFUNDED: [] };
    if (!allowed[order.status]?.includes(status))
      return res.status(400).json({ message: `Không thể chuyển trạng thái từ ${order.status} sang ${status}` });

    await prisma.$transaction(async (tx) => {
      if (order.status === 'PENDING' && status === 'COMPLETED') {
        for (const item of order.items) {
          const prod = await tx.product.findUnique({ where: { id: item.productId } });
          await tx.product.update({ where: { id: item.productId }, data: { stock: { decrement: item.qty } } });
          await tx.stockLog.create({ data: { productId: item.productId, type: 'EXPORT', qty: item.qty, before: prod.stock, after: prod.stock - item.qty, note: `Xác nhận đơn - ${order.orderCode}` } });
        }
        if (order.customerId) {
          await tx.customer.update({ where: { id: order.customerId }, data: { totalSpent: { increment: order.total }, points: { increment: Math.floor(order.total / 1000) } } });
        }
        // Tạo công nợ phải thu - luôn UNPAID, chờ xác nhận thủ công
        if (order.customerId) {
          const existing = await tx.debt.findUnique({ where: { orderId: order.id } });
          if (!existing) {
            await tx.debt.create({
              data: {
                type: 'CUSTOMER', customerId: order.customerId, orderId: order.id,
                amount: order.total, paid: 0, remaining: order.total,
                status: 'UNPAID',
                note: `Đơn hàng ${order.orderCode}`
              }
            });
          }
        }
      }

      if (order.status === 'COMPLETED' && (status === 'REFUNDED' || status === 'CANCELLED')) {
        for (const item of order.items) {
          const prod = await tx.product.findUnique({ where: { id: item.productId } });
          await tx.product.update({ where: { id: item.productId }, data: { stock: { increment: item.qty } } });
          await tx.stockLog.create({ data: { productId: item.productId, type: 'RETURN', qty: item.qty, before: prod.stock, after: prod.stock + item.qty, note: `Hoàn trả - ${order.orderCode}` } });
        }
        if (order.customerId) {
          await tx.customer.update({ where: { id: order.customerId }, data: { totalSpent: { decrement: order.total }, points: { decrement: Math.floor(order.total / 1000) } } });
        }
        // Xóa/cập nhật công nợ khi hủy hoặc hoàn hàng
        const debt = await tx.debt.findUnique({ where: { orderId: order.id } });
        if (debt) {
          if (debt.status === 'UNPAID' && order.customerId) {
            await tx.customer.update({ where: { id: order.customerId }, data: { debt: { decrement: debt.remaining } } });
          }
          await tx.debt.delete({ where: { orderId: order.id } });
        }
      }

      await tx.order.update({ where: { id: order.id }, data: { status } });
      await tx.auditLog.create({ data: { userId: req.user.id, action: `STATUS_${status}`, entity: 'Order', entityId: order.id } });
    });

    const updated = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: { customer: true, user: { select: { id: true, name: true } }, items: { include: { product: true } } }
    });
    res.json(updated);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

module.exports = router;

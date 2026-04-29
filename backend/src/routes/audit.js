const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const auth = require('../middleware/auth');
const role = require('../middleware/role');
const prisma = new PrismaClient();

router.get('/', auth, role('ADMIN', 'MANAGER'), async (req, res) => {
  try {
    const { userId, entity, page = 1, limit = 50 } = req.query;
    const where = { ...(userId && { userId }), ...(entity && { entity }) };
    const logs = await prisma.auditLog.findMany({ where, include: { user: { select: { id: true, name: true } } }, skip: (page - 1) * limit, take: +limit, orderBy: { createdAt: 'desc' } });
    res.json(logs);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

module.exports = router;

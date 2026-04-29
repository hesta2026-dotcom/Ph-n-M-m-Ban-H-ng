const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const auth = require('../middleware/auth');
const prisma = new PrismaClient();

router.get('/', auth, async (req, res) => {
  try {
    const channels = await prisma.salesChannel.findMany({ include: { _count: { select: { products: true } } } });
    res.json(channels);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

router.post('/', auth, async (req, res) => {
  try {
    const channel = await prisma.salesChannel.create({ data: req.body });
    res.status(201).json(channel);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

module.exports = router;

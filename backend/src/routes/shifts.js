const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const auth = require('../middleware/auth');
const prisma = new PrismaClient();

router.post('/open', auth, async (req, res) => {
  try {
    const shift = await prisma.shift.create({ data: { userId: req.user.id, startTime: new Date(), openCash: req.body.openCash || 0 } });
    res.status(201).json(shift);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

router.patch('/:id/close', auth, async (req, res) => {
  try {
    const shift = await prisma.shift.update({ where: { id: req.params.id }, data: { endTime: new Date(), closeCash: req.body.closeCash, note: req.body.note } });
    res.json(shift);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

router.get('/', auth, async (req, res) => {
  try {
    const shifts = await prisma.shift.findMany({ include: { user: { select: { id: true, name: true } } }, orderBy: { startTime: 'desc' }, take: 20 });
    res.json(shifts);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

module.exports = router;

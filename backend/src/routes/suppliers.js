const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const auth = require('../middleware/auth');
const prisma = new PrismaClient();

router.get('/', auth, async (req, res) => {
  try {
    const { search } = req.query;
    const where = search ? { OR: [{ name: { contains: search, mode: 'insensitive' } }, { phone: { contains: search } }] } : {};
    const suppliers = await prisma.supplier.findMany({ where, orderBy: { name: 'asc' } });
    res.json(suppliers);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

router.post('/', auth, async (req, res) => {
  try {
    const supplier = await prisma.supplier.create({ data: req.body });
    res.status(201).json(supplier);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const supplier = await prisma.supplier.update({ where: { id: req.params.id }, data: req.body });
    res.json(supplier);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

module.exports = router;

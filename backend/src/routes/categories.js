const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const auth = require('../middleware/auth');
const prisma = new PrismaClient();

router.get('/', auth, async (req, res) => {
  try {
    const categories = await prisma.category.findMany({ where: { parentId: null }, include: { children: true, _count: { select: { products: true } } }, orderBy: { name: 'asc' } });
    res.json(categories);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

router.post('/', auth, async (req, res) => {
  try {
    const { name, parentId } = req.body;
    const slug = name.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now();
    const category = await prisma.category.create({ data: { name, slug, parentId } });
    res.status(201).json(category);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const category = await prisma.category.update({ where: { id: req.params.id }, data: req.body });
    res.json(category);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    await prisma.category.delete({ where: { id: req.params.id } });
    res.json({ message: 'Đã xóa danh mục' });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

module.exports = router;

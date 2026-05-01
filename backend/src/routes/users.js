const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const auth = require('../middleware/auth');
const role = require('../middleware/role');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

router.get('/', auth, role('ADMIN', 'MANAGER'), async (req, res) => {
  try {
    const users = await prisma.user.findMany({ select: { id: true, name: true, email: true, phone: true, role: true, isActive: true, createdAt: true } });
    res.json(users);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

router.put('/:id', auth, role('ADMIN'), async (req, res) => {
  try {
    const { password, ...rest } = req.body;
    const data = { ...rest };
    if (password) data.password = await bcrypt.hash(password, 10);
    const user = await prisma.user.update({ where: { id: req.params.id }, data, select: { id: true, name: true, email: true, role: true, isActive: true } });
    res.json(user);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

router.delete('/:id', auth, role('ADMIN'), async (req, res) => {
  try {
    await prisma.user.delete({ where: { id: req.params.id } });
    res.json({ message: 'Đã xóa' });
  } catch (e) { res.status(400).json({ message: 'Không thể xóa nhân viên đang có dữ liệu liên quan' }); }
});

module.exports = router;

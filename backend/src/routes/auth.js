const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive) return res.status(401).json({ message: 'Tài khoản không tồn tại' });
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ message: 'Sai mật khẩu' });
    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN });
    const { password: _, ...userInfo } = user;
    res.json({ token, user: userInfo });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role, phone } = req.body;
    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) return res.status(400).json({ message: 'Email đã tồn tại' });
    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({ data: { name, email, password: hashed, role, phone } });
    const { password: _, ...userInfo } = user;
    res.status(201).json(userInfo);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

module.exports = router;

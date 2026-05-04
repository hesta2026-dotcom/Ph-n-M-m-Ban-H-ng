const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const auth = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');
const prisma = new PrismaClient();

// Multer config — lưu ảnh vào uploads/products/
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../../uploads/products');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Chỉ chấp nhận file ảnh'));
  }
});

// Multer cho import Excel
const xlsxUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// Upload ảnh sản phẩm (tối đa 5 ảnh)
router.post('/upload-images', auth, upload.array('images', 5), (req, res) => {
  if (!req.files || req.files.length === 0)
    return res.status(400).json({ message: 'Không có file nào được upload' });
  const urls = req.files.map(f => `/uploads/products/${f.filename}`);
  res.json({ urls });
});

// ── Tải file mẫu Excel ──
router.get('/template', auth, (req, res) => {
  const headers = [
    'Tên sản phẩm *', 'Mã sản phẩm *', 'Barcode',
    'ĐVT lẻ *', 'ĐVT thùng/hộp', 'SL lẻ/thùng',
    'Giá bán (lẻ) *', 'Giá vốn (lẻ)',
    'Tồn kho (thùng)', 'Tồn kho (lẻ)', 'Tồn kho tối thiểu',
    'Thương hiệu', 'Nhà sản xuất',
    'Danh mục (tên)', 'Nhà cung cấp (tên)', 'Mô tả'
  ];
  const ex1 = [
    'Nước ngọt A', 'NNA001', '8934000000001',
    'chai', 'thùng', 24,
    8000, 5500,
    2, 6, 10,
    '', '', 'Nước uống', '', ''
  ];
  const ex2 = [
    'Sữa hộp B', 'SHB002', '8936000000002',
    'hộp', 'thùng', 48,
    12000, 8000,
    1, 10, 12,
    'Vinamilk', 'Vinamilk Corp', 'Sữa & Sản phẩm', '', ''
  ];
  const ex3 = [
    'Đường tinh luyện', 'DTL003', '',
    'kg', 'bao', 50,
    25000, 18000,
    0, 30, 5,
    '', '', 'Thực phẩm', '', ''
  ];
  const note = [
    '--- HƯỚNG DẪN ---',
    '• ĐVT lẻ: đơn vị nhỏ nhất (chai, cái, kg, hộp...)',
    '• ĐVT thùng/hộp: để TRỐNG nếu không bán theo thùng',
    '• SL lẻ/thùng: số lượng lẻ trong 1 thùng (vd: 24)',
    '• Tồn kho (thùng) + Tồn kho (lẻ) → tự tính tổng',
    '• Ví dụ: 2 thùng × 24 + 6 lẻ = 54 chai tồn kho',
    '', '', '', '', '', '', '', '', '', ''
  ];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headers, ex1, ex2, ex3, [], note]);
  ws['!cols'] = headers.map((_, i) => ({ wch: i < 3 ? 24 : 18 }));
  // Tô màu header
  const range = XLSX.utils.decode_range(ws['!ref']);
  for (let c = range.s.c; c <= range.e.c; c++) {
    const cell = ws[XLSX.utils.encode_cell({ r: 0, c })];
    if (cell) cell.s = { fill: { fgColor: { rgb: '1E40AF' } }, font: { bold: true, color: { rgb: 'FFFFFF' } } };
  }
  XLSX.utils.book_append_sheet(wb, ws, 'Sản phẩm');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Disposition', 'attachment; filename="mau_san_pham.xlsx"');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buf);
});

// ── Xuất danh sách sản phẩm ra Excel ──
router.get('/export', auth, async (req, res) => {
  try {
    const { ids } = req.query;
    const where = ids
      ? { id: { in: ids.split(',').filter(Boolean) } }
      : { isActive: true };
    const products = await prisma.product.findMany({
      where,
      include: { category: true, supplier: true },
      orderBy: { name: 'asc' }
    });
    const headers = [
      'Tên sản phẩm', 'Mã sản phẩm', 'Barcode', 'Đơn vị tính',
      'Giá bán', 'Giá vốn', 'Tồn kho', 'Tồn kho tối thiểu',
      'Thương hiệu', 'Công ty sản xuất', 'Quy cách đóng gói',
      'Danh mục', 'Nhà cung cấp', 'Mô tả'
    ];
    const rows = products.map(p => [
      p.name, p.code, p.barcode || '', p.unit,
      p.price, p.costPrice, p.stock, p.minStock,
      p.brand || '', p.manufacturer || '', p.specification || '',
      p.category?.name || '', p.supplier?.name || '', p.description || ''
    ]);
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws['!cols'] = headers.map(() => ({ wch: 22 }));
    XLSX.utils.book_append_sheet(wb, ws, 'Sản phẩm');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const now = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Disposition', `attachment; filename="san_pham_${now}.xlsx"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buf);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// ── Import sản phẩm từ Excel ──
router.post('/import', auth, xlsxUpload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Không có file' });
    const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
    if (rows.length < 2) return res.status(400).json({ message: 'File không có dữ liệu' });

    const [categories, suppliers] = await Promise.all([
      prisma.category.findMany(),
      prisma.supplier.findMany()
    ]);
    const catMap = Object.fromEntries(categories.map(c => [c.name.trim().toLowerCase(), c.id]));
    const supMap = Object.fromEntries(suppliers.map(s => [s.name.trim().toLowerCase(), s.id]));

    let created = 0, skipped = 0, errors = [];
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r || !r[0] || !r[1]) { skipped++; continue; }

      // Cột mới: Tên | Mã | Barcode | ĐVT lẻ | ĐVT thùng | SL/thùng | Giá bán | Giá vốn | Tồn thùng | Tồn lẻ | Tối thiểu | Thương hiệu | NX | Danh mục | NCC | Mô tả
      const [name, code, barcode, unit, packageUnit, packageQty,
             price, costPrice, stockThung, stockLe, minStock,
             brand, manufacturer, catName, supName, description] = r;

      if (!name || !code || !price) { skipped++; continue; }

      // Tính tổng tồn kho: thùng × SL/thùng + lẻ
      const pQty = packageQty ? +packageQty : 0;
      const sThung = stockThung ? +stockThung : 0;
      const sLe = stockLe ? +stockLe : 0;
      const totalStock = pQty > 0 ? (sThung * pQty + sLe) : (sThung + sLe);

      try {
        const existing = await prisma.product.findFirst({ where: { code: String(code) } });
        if (existing) { skipped++; errors.push(`Dòng ${i + 1}: Mã "${code}" đã tồn tại`); continue; }
        const categoryId = catName ? (catMap[String(catName).trim().toLowerCase()] || null) : null;
        const supplierId = supName ? (supMap[String(supName).trim().toLowerCase()] || null) : null;
        await prisma.product.create({
          data: {
            name: String(name), code: String(code),
            barcode: barcode ? String(barcode) : null,
            unit: unit ? String(unit) : 'cái',
            packageUnit: packageUnit ? String(packageUnit) : null,
            packageQty: pQty > 0 ? pQty : null,
            price: +price || 0, costPrice: +(costPrice || 0),
            stock: totalStock, minStock: +(minStock || 5),
            brand: brand ? String(brand) : null,
            manufacturer: manufacturer ? String(manufacturer) : null,
            categoryId, supplierId,
            description: description ? String(description) : null
          }
        });
        created++;
      } catch (err) {
        errors.push(`Dòng ${i + 1}: ${err.message}`);
        skipped++;
      }
    }
    res.json({ created, skipped, errors: errors.slice(0, 10) });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

router.get('/', auth, async (req, res) => {
  try {
    const { search, categoryId, supplierId, lowStock, page = 1, limit = 20 } = req.query;
    const where = { isActive: true };
    if (search) where.OR = [
      { name: { contains: search } },
      { code: { contains: search } },
      { barcode: { contains: search } },
      { brand: { contains: search } },
      { manufacturer: { contains: search } },
    ];
    if (categoryId) where.categoryId = categoryId;
    if (supplierId) where.supplierId = supplierId;
    if (lowStock === 'true') {
      const ids = await prisma.$queryRaw`SELECT id FROM Product WHERE isActive = 1 AND stock <= minStock`;
      where.id = { in: ids.map(r => r.id) };
    }
    const [products, total] = await Promise.all([
      prisma.product.findMany({ where, include: { category: true, supplier: true }, skip: (page - 1) * +limit, take: +limit, orderBy: { name: 'asc' } }),
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
    const { name, code, barcode, price, costPrice, stock, minStock, unit,
            packageUnit, packageQty,
            categoryId, supplierId, description,
            brand, manufacturer, specification, image, images } = req.body;
    const product = await prisma.product.create({
      data: {
        name, code, barcode: barcode || null, price: +price, costPrice: +(costPrice || 0),
        stock: +(stock || 0), minStock: +(minStock || 5), unit: unit || 'cái',
        packageUnit: packageUnit || null, packageQty: packageQty ? +packageQty : null,
        categoryId: categoryId || null, supplierId: supplierId || null,
        description: description || null, brand: brand || null,
        manufacturer: manufacturer || null, specification: specification || null,
        image: image || null, images: images || null
      }
    });
    res.status(201).json(product);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const { name, code, barcode, price, costPrice, stock, minStock, unit,
            packageUnit, packageQty,
            categoryId, supplierId, description,
            brand, manufacturer, specification, image, images } = req.body;
    const old = await prisma.product.findUnique({ where: { id: req.params.id } });
    const product = await prisma.product.update({
      where: { id: req.params.id },
      data: {
        name, code, barcode: barcode || null, price: +price, costPrice: +(costPrice || 0),
        stock: +(stock || 0), minStock: +(minStock || 5), unit: unit || 'cái',
        packageUnit: packageUnit || null, packageQty: packageQty ? +packageQty : null,
        categoryId: categoryId || null, supplierId: supplierId || null,
        description: description || null, brand: brand || null,
        manufacturer: manufacturer || null, specification: specification || null,
        image: image || null, images: images || null
      }
    });
    await prisma.auditLog.create({
      data: { userId: req.user.id, action: 'UPDATE', entity: 'Product', entityId: product.id,
              oldData: JSON.stringify(old), newData: JSON.stringify(product) }
    });
    res.json(product);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

router.patch('/:id/image', auth, async (req, res) => {
  try {
    const { image } = req.body;
    const product = await prisma.product.update({ where: { id: req.params.id }, data: { image: image || null } });
    res.json(product);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    await prisma.product.update({ where: { id: req.params.id }, data: { isActive: false } });
    res.json({ message: 'Đã xóa sản phẩm' });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// ── Điều chỉnh tồn kho ──
router.patch('/:id/stock', auth, async (req, res) => {
  try {
    const { type, qty, note } = req.body;
    // type: ADJUST_ADD | ADJUST_REMOVE | ADJUST_SET
    const product = await prisma.product.findUnique({ where: { id: req.params.id } });
    if (!product) return res.status(404).json({ message: 'Không tìm thấy sản phẩm' });
    const before = product.stock;
    let after;
    if (type === 'ADJUST_SET') {
      after = +qty;
    } else if (type === 'ADJUST_ADD') {
      after = before + +qty;
    } else if (type === 'ADJUST_REMOVE') {
      after = before - +qty;
      if (after < 0) return res.status(400).json({ message: 'Tồn kho không đủ để xuất' });
    } else {
      return res.status(400).json({ message: 'Loại điều chỉnh không hợp lệ' });
    }
    const [updated] = await prisma.$transaction([
      prisma.product.update({ where: { id: req.params.id }, data: { stock: after } }),
      prisma.stockLog.create({ data: { productId: req.params.id, type, qty: +qty, before, after, note: note || null } })
    ]);
    res.json(updated);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

module.exports = router;

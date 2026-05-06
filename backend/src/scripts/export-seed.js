/**
 * Export Railway data → prisma/seed-data.json
 * Run after adding new products/categories/suppliers to keep snapshot up-to-date
 * Usage: node src/scripts/export-seed.js
 */
const https = require('https');
const fs = require('fs');
const path = require('path');

const HOST = 'ph-n-m-m-ban-h-ng-production-5958.up.railway.app';

function api(method, p, body, token) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = https.request({
      hostname: HOST, path: p, method, timeout: 60000,
      headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': 'Bearer ' + token } : {}), ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}) }
    }, res => { let d = ''; res.on('data', c => d += c); res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve(d); } }); });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    if (data) req.write(data);
    req.end();
  });
}

async function main() {
  console.log('Đăng nhập Railway...');
  const { token } = await api('POST', '/api/auth/login', { email: 'admin@pos.com', password: '123456' });

  console.log('Lấy dữ liệu...');
  const [cats, sups, prods] = await Promise.all([
    api('GET', '/api/categories', null, token),
    api('GET', '/api/suppliers', null, token),
    api('GET', '/api/products?limit=9999&page=1', null, token),
  ]);

  const seed = {
    categories: (cats || []).map(c => ({ name: c.name, slug: c.slug })),
    suppliers: (sups || []).map(s => ({ name: s.name, phone: s.phone, email: s.email, address: s.address })),
    products: (prods.data || prods || []).map(p => ({
      code: p.code, name: p.name, barcode: p.barcode || null,
      unit: p.unit, packageUnit: p.packageUnit || null, packageQty: p.packageQty || null,
      price: p.price, costPrice: p.costPrice, stock: p.stock, minStock: p.minStock,
      brand: p.brand || null, manufacturer: p.manufacturer || null, description: p.description || null,
      categoryName: p.category?.name || null, supplierName: p.supplier?.name || null
    }))
  };

  const outPath = path.join(__dirname, '../../prisma/seed-data.json');
  fs.writeFileSync(outPath, JSON.stringify(seed));
  console.log(`\n✓ Đã export:`);
  console.log(`  ${seed.categories.length} danh mục`);
  console.log(`  ${seed.suppliers.length} nhà cung cấp`);
  console.log(`  ${seed.products.length} sản phẩm`);
  console.log(`\nFile: ${outPath}`);
  console.log('\nChạy tiếp để commit snapshot:');
  console.log('  git add backend/prisma/seed-data.json && git commit -m "chore: update seed snapshot" && git push');
}

main().catch(e => { console.error('Lỗi:', e.message); process.exit(1); });

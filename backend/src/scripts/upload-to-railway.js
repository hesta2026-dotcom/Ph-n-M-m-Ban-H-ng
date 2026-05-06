const { PrismaClient } = require('@prisma/client');
const XLSX = require('xlsx');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const RAILWAY_URL = 'https://ph-n-m-m-ban-h-ng-production-5958.up.railway.app';

const prisma = new PrismaClient({
  datasources: { db: { url: 'file:' + path.join(__dirname, '../../prisma/posdb.db') } }
});

async function getToken() {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ email: 'admin@pos.com', password: '123456' });
    const url = new URL(RAILWAY_URL + '/api/auth/login');
    const options = {
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    };
    const req = https.request(options, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.token) resolve(json.token);
          else reject(new Error('No token: ' + data));
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  console.log('Lấy dữ liệu từ local DB...');
  const products = await prisma.product.findMany({
    where: { isActive: true },
    include: { category: true, supplier: true },
    orderBy: { code: 'asc' }
  });
  console.log(`Tìm thấy ${products.length} sản phẩm`);

  const rows = products.map(p => ({
    'Tên sản phẩm *': p.name,
    'Mã sản phẩm *': p.code,
    'Barcode': p.barcode || '',
    'ĐVT lẻ *': p.unit,
    'ĐVT thùng/hộp': p.packageUnit || '',
    'SL lẻ/thùng': p.packageQty || '',
    'Giá bán (lẻ) *': p.price,
    'Giá vốn (lẻ)': p.costPrice || '',
    'Tồn kho (thùng)': p.packageQty ? Math.floor(p.stock / p.packageQty) : '',
    'Tồn kho (lẻ)': p.packageQty ? p.stock % p.packageQty : p.stock,
    'Tồn kho tối thiểu': p.minStock || '',
    'Thương hiệu': p.brand || '',
    'Nhà sản xuất': p.manufacturer || '',
    'Danh mục (tên)': p.category?.name || '',
    'Nhà cung cấp (tên)': p.supplier?.name || '',
    'Mô tả': p.description || ''
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, 'Products');
  const xlsxBuf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  console.log(`Đã tạo Excel: ${xlsxBuf.length} bytes`);

  console.log('Đăng nhập Railway...');
  const token = await getToken();
  console.log('Token OK');

  console.log('Upload lên Railway...');
  await new Promise((resolve, reject) => {
    const boundary = '----FormBoundary' + Date.now();
    const filename = 'products.xlsx';
    const header = Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\r\n\r\n`
    );
    const footer = Buffer.from(`\r\n--${boundary}--\r\n`);
    const bodyBuf = Buffer.concat([header, xlsxBuf, footer]);

    const url = new URL(RAILWAY_URL + '/api/products/import');
    const options = {
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': bodyBuf.length
      },
      timeout: 120000
    };

    const req = https.request(options, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          console.log(`\nKết quả:`);
          console.log(`  Tổng: ${json.total}`);
          console.log(`  Tạo mới: ${json.created}`);
          console.log(`  Bỏ qua: ${json.skipped}`);
          if (json.errors && json.errors.length > 0) {
            console.log(`  Lỗi (${json.errors.length}):`);
            json.errors.slice(0, 5).forEach(e => console.log(`    - ${e}`));
          }
          resolve();
        } catch (e) {
          console.log('Response:', data);
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    req.write(bodyBuf);
    req.end();
  });

  await prisma.$disconnect();
  console.log('\nHoàn thành!');
}

main().catch(e => { console.error('Lỗi:', e.message); process.exit(1); });

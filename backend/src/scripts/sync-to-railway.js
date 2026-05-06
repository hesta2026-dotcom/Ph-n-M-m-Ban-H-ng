/**
 * Sync local data → Railway
 * Syncs: Suppliers, Purchases, Debts, Expenses
 */
require('dotenv').config();
const https = require('https');

const HOST = 'ph-n-m-m-ban-h-ng-production-5958.up.railway.app';

function api(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = https.request({
      hostname: HOST, path, method, timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': 'Bearer ' + token } : {}),
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {})
      }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve(d); } });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    if (data) req.write(data);
    req.end();
  });
}

async function main() {
  console.log('=== SYNC LOCAL → RAILWAY ===\n');

  // 1. Login
  const { token } = await api('POST', '/api/auth/login', { email: 'admin@pos.com', password: '123456' });
  console.log('✓ Đã đăng nhập Railway\n');

  // 2. Suppliers
  const existingSuppliers = await api('GET', '/api/suppliers', null, token);
  const existingSupMap = {};
  (existingSuppliers || []).forEach(s => existingSupMap[s.name] = s.id);

  const localSuppliers = [
    { name: 'Xốp Đông Á', phone: '0908100647', email: '', address: '29 Trần Thị Năm, Tân Chánh Hiệp,Q.12', _localId: 'ff23da22-6fbd-408d-a25f-c06615130e90' },
    { name: 'Gia Phát', phone: '0345961887', email: '', address: 'Nguyễn Văn Quá', _localId: '3c315925-90ec-4839-9932-709895ce39e9' }
  ];

  const supIdMap = {}; // local id → railway id
  for (const sup of localSuppliers) {
    if (existingSupMap[sup.name]) {
      supIdMap[sup._localId] = existingSupMap[sup.name];
      console.log(`✓ Supplier đã tồn tại: ${sup.name}`);
    } else {
      const { _localId, ...body } = sup;
      const res = await api('POST', '/api/suppliers', body, token);
      supIdMap[sup._localId] = res.id;
      console.log(`✓ Đã tạo supplier: ${sup.name} → ${res.id}`);
    }
  }

  // 3. Products code → Railway ID map
  const rProducts = await api('GET', '/api/products?limit=9999&page=1', null, token);
  const prodCodeMap = {};
  (rProducts.data || []).forEach(p => prodCodeMap[p.code] = p.id);
  console.log(`\n✓ Đã map ${Object.keys(prodCodeMap).length} sản phẩm\n`);

  // 4. Get Railway admin user id
  const rUsers = await api('GET', '/api/users', null, token);
  const adminUser = (rUsers || []).find(u => u.email === 'admin@pos.com');
  const adminId = adminUser?.id;
  console.log(`✓ Admin Railway ID: ${adminId}\n`);

  // 5. Purchases
  const existingPurchases = await api('GET', '/api/purchases?limit=999', null, token);
  const existingPurchaseCodes = new Set((existingPurchases.data || existingPurchases || []).map(p => p.code));

  const localPurchases = [
    {
      code: 'NK1778055278445',
      supplierId_local: 'ff23da22-6fbd-408d-a25f-c06615130e90',
      status: 'COMPLETED', total: 3520000, paid: 0, debt: 3520000, note: null,
      items: [
        { productCode: 'XC3', qty: 8, costPrice: 320000, total: 2560000 },
        { productCode: 'XC4', qty: 3, costPrice: 320000, total: 960000 }
      ]
    },
    {
      code: 'NK1778055564365',
      supplierId_local: '3c315925-90ec-4839-9932-709895ce39e9',
      status: 'COMPLETED', total: 3240000, paid: 0, debt: 3240000, note: null,
      items: [
        { productCode: 'BKY200', qty: 40, costPrice: 81000, total: 3240000 }
      ]
    }
  ];

  for (const po of localPurchases) {
    if (existingPurchaseCodes.has(po.code)) {
      console.log(`✓ Purchase đã tồn tại: ${po.code}`);
      continue;
    }
    const body = {
      code: po.code,
      supplierId: supIdMap[po.supplierId_local],
      status: po.status,
      total: po.total,
      paid: po.paid,
      debt: po.debt,
      note: po.note,
      items: po.items.map(item => ({
        productId: prodCodeMap[item.productCode],
        qty: item.qty,
        costPrice: item.costPrice,
        total: item.total
      })).filter(item => item.productId)
    };
    const res = await api('POST', '/api/purchases', body, token);
    console.log(`✓ Đã tạo purchase: ${po.code} (${res.id || JSON.stringify(res).slice(0,50)})`);
  }

  // 6. Debts
  const existingDebts = await api('GET', '/api/debts?limit=999', null, token);
  const existingDebtNotes = new Set((existingDebts.data || existingDebts || []).map(d => d.note));

  const localDebts = [
    {
      type: 'SUPPLIER', supplierId_local: 'ff23da22-6fbd-408d-a25f-c06615130e90',
      amount: 3520000, paid: 3520000, remaining: 0, status: 'PAID',
      note: 'Phiếu nhập NK1778055278445'
    },
    {
      type: 'SUPPLIER', supplierId_local: '3c315925-90ec-4839-9932-709895ce39e9',
      amount: 3240000, paid: 0, remaining: 3240000, status: 'UNPAID',
      note: 'Phiếu nhập NK1778055564365'
    }
  ];

  for (const debt of localDebts) {
    if (existingDebtNotes.has(debt.note)) {
      console.log(`✓ Debt đã tồn tại: ${debt.note}`);
      continue;
    }
    const body = {
      type: debt.type,
      supplierId: supIdMap[debt.supplierId_local],
      amount: debt.amount,
      paid: debt.paid,
      remaining: debt.remaining,
      status: debt.status,
      note: debt.note
    };
    const res = await api('POST', '/api/debts', body, token);
    console.log(`✓ Đã tạo debt: ${debt.note} (${res.id || JSON.stringify(res).slice(0,50)})`);
  }

  // 7. Expenses
  const existingExpenses = await api('GET', '/api/expenses?limit=999', null, token);
  const existingExpDescs = new Set((existingExpenses.data || existingExpenses || []).map(e => e.description));

  const localExpenses = [
    {
      type: 'EXPENSE', category: 'Thanh toán nhà cung cấp',
      amount: 3520000,
      description: 'Thanh toán công nợ - Phiếu nhập NK1778055278445'
    }
  ];

  for (const exp of localExpenses) {
    if (existingExpDescs.has(exp.description)) {
      console.log(`✓ Expense đã tồn tại: ${exp.description}`);
      continue;
    }
    const body = { ...exp, userId: adminId };
    const res = await api('POST', '/api/expenses', body, token);
    console.log(`✓ Đã tạo expense: ${exp.description} (${res.id || JSON.stringify(res).slice(0,50)})`);
  }

  console.log('\n=== SYNC HOÀN THÀNH ===');
}

main().catch(e => console.error('Lỗi:', e.message));

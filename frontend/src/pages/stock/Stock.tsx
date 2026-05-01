import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../../services/api'
import toast from 'react-hot-toast'
import { AlertTriangle, Plus, Package, Tag, Building2, X, PackagePlus, FileSpreadsheet, FileText } from 'lucide-react'
import { exportExcel, exportPDF, PRESETS, fmtPeriod } from '../../utils/export'
import NewProductModal from '../products/NewProductModal'
import NewSupplierModal from '../suppliers/NewSupplierModal'
import ColumnPicker, { ColDef } from '../../components/ColumnPicker'

const fmt = (n: number) => new Intl.NumberFormat('vi-VN').format(n) + 'đ'

const COLS_LOW: ColDef[] = [
  { key: 'product', label: 'Sản phẩm' },
  { key: 'brandMfr', label: 'Thương hiệu / CTSX' },
  { key: 'specification', label: 'Quy cách' },
  { key: 'unit', label: 'Đơn vị' },
  { key: 'stock', label: 'Tồn kho' },
  { key: 'minStock', label: 'Tối thiểu' },
  { key: 'costPrice', label: 'Giá vốn' },
]
const COLS_ALL: ColDef[] = [
  { key: 'product', label: 'Sản phẩm' },
  { key: 'brandMfr', label: 'Thương hiệu / CTSX' },
  { key: 'specification', label: 'Quy cách' },
  { key: 'unit', label: 'Đơn vị' },
  { key: 'stock', label: 'Tồn kho' },
  { key: 'minStock', label: 'Tối thiểu' },
  { key: 'price', label: 'Giá bán' },
  { key: 'costPrice', label: 'Giá vốn' },
]
const COLS_LOGS: ColDef[] = [
  { key: 'product', label: 'Sản phẩm' },
  { key: 'type', label: 'Loại' },
  { key: 'qty', label: 'Số lượng' },
  { key: 'before', label: 'Tồn trước' },
  { key: 'after', label: 'Tồn sau' },
  { key: 'note', label: 'Ghi chú' },
  { key: 'createdAt', label: 'Thời gian' },
]
const COLS_PURCHASE: ColDef[] = [
  { key: 'code', label: 'Mã phiếu' },
  { key: 'supplier', label: 'Nhà cung cấp' },
  { key: 'total', label: 'Tổng tiền' },
  { key: 'paid', label: 'Đã trả' },
  { key: 'debt', label: 'Còn nợ' },
  { key: 'status', label: 'Trạng thái' },
  { key: 'createdAt', label: 'Ngày nhập' },
]

function ProductThumb({ product, size = 'sm' }: { product: any; size?: 'sm' | 'md' }) {
  const imgs: string[] = product?.images ? JSON.parse(product.images) : []
  const thumb = product?.image || imgs[0]
  const cls = size === 'sm' ? 'w-10 h-10' : 'w-14 h-14'
  return (
    <div className={`${cls} rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0 overflow-hidden`}>
      {thumb
        ? <img src={thumb} alt="" className="w-full h-full object-cover" />
        : <Package size={size === 'sm' ? 14 : 18} className="text-gray-400" />}
    </div>
  )
}

function ProductInfo({ product }: { product: any }) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <ProductThumb product={product} />
      <div className="min-w-0">
        <p className="font-medium truncate">{product?.name}</p>
        <div className="flex items-center gap-2 flex-wrap">
          {product?.brand && (
            <span className="text-xs text-purple-600 flex items-center gap-0.5">
              <Tag size={10} />{product.brand}
            </span>
          )}
          {product?.specification && (
            <span className="text-xs text-gray-400">{product.specification}</span>
          )}
        </div>
      </div>
    </div>
  )
}

export default function Stock() {
  const [tab, setTab] = useState<'low' | 'all' | 'logs' | 'purchase'>('low')
  const [viewPurchase, setViewPurchase] = useState<any>(null)
  const now2 = new Date()
  const [from, setFrom] = useState(new Date(now2.getFullYear(), now2.getMonth(), 1).toISOString().slice(0, 10))
  const [to, setTo] = useState(now2.toISOString().slice(0, 10))
  const [activePreset, setActivePreset] = useState('Tháng này')
  const applyPreset = (p: typeof PRESETS[number]) => { const [f, t] = p.getDates(); setFrom(f); setTo(t); setActivePreset(p.label) }
  const [showAdjust, setShowAdjust] = useState(false)
  const [adjustForm, setAdjustForm] = useState({ productId: '', newStock: 0, note: '' })
  const [showPurchase, setShowPurchase] = useState(false)
  const [newProductForItemIdx, setNewProductForItemIdx] = useState<number | null>(null)
  const [showNewSupplier, setShowNewSupplier] = useState(false)
  const [searchLow, setSearchLow] = useState('')
  const [searchAll, setSearchAll] = useState('')
  const [searchLogs, setSearchLogs] = useState('')
  const [searchPurchase, setSearchPurchase] = useState('')
  const [selectedLogIds, setSelectedLogIds] = useState<Set<string>>(new Set())
  const [selectedPurchaseIds, setSelectedPurchaseIds] = useState<Set<string>>(new Set())
  const [visLow, setVisLow] = useState<Set<string>>(() => new Set(COLS_LOW.map(c => c.key)))
  const [visAll, setVisAll] = useState<Set<string>>(() => new Set(COLS_ALL.map(c => c.key)))
  const [visLogs, setVisLogs] = useState<Set<string>>(() => new Set(COLS_LOGS.map(c => c.key)))
  const [visPurchase, setVisPurchase] = useState<Set<string>>(() => new Set(COLS_PURCHASE.map(c => c.key)))
  const qc = useQueryClient()

  const { data: lowStockData } = useQuery({
    queryKey: ['low-stock'],
    queryFn: () => api.get('/stock/low').then(r => r.data)
  })
  const { data: allProducts } = useQuery({
    queryKey: ['stock-all', searchAll],
    queryFn: () => api.get(`/products?search=${searchAll}&limit=100`).then(r => r.data.data),
    enabled: tab === 'all'
  })
  const { data: logs } = useQuery({
    queryKey: ['stock-logs', from, to],
    queryFn: () => api.get(`/stock/logs?limit=200&from=${from}&to=${to}`).then(r => r.data),
    enabled: tab === 'logs'
  })
  const { data: purchases } = useQuery({
    queryKey: ['purchases', from, to],
    queryFn: () => api.get(`/purchases?limit=200&from=${from}&to=${to}`).then(r => r.data),
    enabled: tab === 'purchase'
  })
  const { data: products } = useQuery({
    queryKey: ['products-all'],
    queryFn: () => api.get('/products?limit=1000').then(r => r.data.data)
  })
  const { data: suppliers } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => api.get('/suppliers').then(r => r.data)
  })

  const adjust = useMutation({
    mutationFn: (d: any) => api.post('/stock/adjust', d),
    onSuccess: () => {
      toast.success('Đã điều chỉnh tồn kho')
      qc.invalidateQueries({ queryKey: ['low-stock'] })
      qc.invalidateQueries({ queryKey: ['stock-logs'] })
      qc.invalidateQueries({ queryKey: ['stock-all'] })
      setShowAdjust(false)
      setAdjustForm({ productId: '', newStock: 0, note: '' })
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Lỗi')
  })

  const [purchaseForm, setPurchaseForm] = useState({
    supplierId: '', paid: 0, note: '',
    items: [{ productId: '', qty: 1, costPrice: 0 }]
  })
  const addPurchaseItem = () =>
    setPurchaseForm(p => ({ ...p, items: [...p.items, { productId: '', qty: 1, costPrice: 0 }] }))
  const removePurchaseItem = (i: number) =>
    setPurchaseForm(p => ({ ...p, items: p.items.filter((_, idx) => idx !== i) }))
  const updatePurchaseItem = (i: number, key: string, val: any) =>
    setPurchaseForm(p => ({ ...p, items: p.items.map((item, idx) => idx === i ? { ...item, [key]: val } : item) }))

  const purchase = useMutation({
    mutationFn: (d: any) => api.post('/purchases', d),
    onSuccess: () => {
      toast.success('Nhập kho thành công')
      qc.invalidateQueries({ queryKey: ['purchases'] })
      qc.invalidateQueries({ queryKey: ['low-stock'] })
      qc.invalidateQueries({ queryKey: ['stock-all'] })
      qc.invalidateQueries({ queryKey: ['products-all'] })
      setShowPurchase(false)
      setPurchaseForm({ supplierId: '', paid: 0, note: '', items: [{ productId: '', qty: 1, costPrice: 0 }] })
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Lỗi')
  })

  const logTypeLabel: any = { IMPORT: 'Nhập kho', EXPORT: 'Xuất kho', ADJUST: 'Điều chỉnh', RETURN: 'Hoàn hàng' }
  const logTypeClass: any = { IMPORT: 'badge-green', EXPORT: 'badge-red', ADJUST: 'badge-yellow', RETURN: 'badge-blue' }

  const selectedAdjustProduct = products?.find((p: any) => p.id === adjustForm.productId)

  const filteredLow = (lowStockData || []).filter((p: any) =>
    !searchLow || p.name.toLowerCase().includes(searchLow.toLowerCase()) ||
    p.code.toLowerCase().includes(searchLow.toLowerCase()) ||
    (p.brand || '').toLowerCase().includes(searchLow.toLowerCase())
  )

  const purchaseTotal = purchaseForm.items.reduce((s, i) => s + i.qty * i.costPrice, 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold">Kho hàng</h1>
        <div className="flex gap-2">
          <button onClick={() => setShowAdjust(true)} className="btn-outline flex items-center gap-2">
            <AlertTriangle size={16} /> Điều chỉnh kho
          </button>
          <button onClick={() => setShowPurchase(true)} className="btn-primary flex items-center gap-2">
            <Plus size={18} /> Nhập hàng
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5">
        {[['low', 'Hàng sắp hết'], ['all', 'Tất cả sản phẩm'], ['logs', 'Lịch sử kho'], ['purchase', 'Phiếu nhập']].map(([val, label]) => (
          <button key={val} onClick={() => setTab(val as any)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === val ? 'bg-blue-600 text-white' : 'bg-white border hover:bg-gray-50'}`}>
            {label}
            {val === 'low' && lowStockData?.length > 0 && (
              <span className="ml-1.5 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5">{lowStockData.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* Bộ lọc thời gian — hiện cho Lịch sử kho và Phiếu nhập */}
      {(tab === 'logs' || tab === 'purchase') && (
        <div className="card py-3">
          <div className="flex items-center flex-wrap gap-3">
            <div className="flex gap-1.5 flex-wrap">
              {PRESETS.map(p => (
                <button key={p.label} onClick={() => applyPreset(p)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${activePreset === p.label ? 'bg-blue-600 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}>
                  {p.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 ml-auto flex-wrap">
              <span className="text-sm text-gray-500">Từ:</span>
              <input type="date" className="input text-sm py-1.5" value={from} onChange={e => { setFrom(e.target.value); setActivePreset('') }} />
              <span className="text-sm text-gray-500">Đến:</span>
              <input type="date" className="input text-sm py-1.5" value={to} onChange={e => { setTo(e.target.value); setActivePreset('') }} />
            </div>
          </div>
        </div>
      )}

      {/* ── Tab: Hàng sắp hết ── */}
      {tab === 'low' && (
        <>
          <div className="flex gap-2 items-center">
            <input className="input flex-1" placeholder="Tìm theo tên, mã, thương hiệu..."
              value={searchLow} onChange={e => setSearchLow(e.target.value)} />
            <ColumnPicker cols={COLS_LOW} visible={visLow} onChange={setVisLow} />
          </div>
          <div className="card p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    {COLS_LOW.filter(c => visLow.has(c.key)).map(c => (
                      <th key={c.key} className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">{c.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredLow.map((p: any) => (
                    <tr key={p.id} className={`hover:bg-gray-50 ${p.stock === 0 ? 'bg-red-50' : ''}`}>
                      {visLow.has('product') && <td className="px-4 py-3"><ProductInfo product={p} /></td>}
                      {visLow.has('brandMfr') && (
                        <td className="px-4 py-3">
                          {p.brand && <p className="font-medium text-sm flex items-center gap-1"><Tag size={12} className="text-purple-400" />{p.brand}</p>}
                          {p.manufacturer && <p className="text-xs text-gray-400 flex items-center gap-1"><Building2 size={11} />{p.manufacturer}</p>}
                          {!p.brand && !p.manufacturer && <span className="text-gray-300">—</span>}
                        </td>
                      )}
                      {visLow.has('specification') && <td className="px-4 py-3 text-gray-500 text-xs">{p.specification || '—'}</td>}
                      {visLow.has('unit') && <td className="px-4 py-3 text-gray-500">{p.unit}</td>}
                      {visLow.has('stock') && (
                        <td className="px-4 py-3">
                          <span className={`badge ${p.stock === 0 ? 'badge-red' : 'badge-yellow'}`}>
                            {p.stock === 0 ? 'Hết hàng' : `${p.stock} ${p.unit}`}
                          </span>
                        </td>
                      )}
                      {visLow.has('minStock') && <td className="px-4 py-3 text-gray-500">{p.minStock}</td>}
                      {visLow.has('costPrice') && <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{fmt(p.costPrice)}</td>}
                    </tr>
                  ))}
                  {!filteredLow.length && (
                    <tr><td colSpan={COLS_LOW.filter(c => visLow.has(c.key)).length} className="text-center py-10 text-gray-400">
                      {searchLow ? 'Không tìm thấy sản phẩm' : 'Tất cả sản phẩm đều đủ hàng'}
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ── Tab: Tất cả sản phẩm ── */}
      {tab === 'all' && (
        <>
          <div className="flex gap-2 items-center">
            <input className="input flex-1" placeholder="Tìm theo tên, mã, thương hiệu..."
              value={searchAll} onChange={e => setSearchAll(e.target.value)} />
            <ColumnPicker cols={COLS_ALL} visible={visAll} onChange={setVisAll} />
            <button onClick={() => {
              const vc = COLS_ALL.filter(c => visAll.has(c.key))
              const headers = vc.map(c => c.label)
              const rows = (allProducts || []).map((p: any) => vc.map(c => {
                switch (c.key) {
                  case 'product': return p.name
                  case 'brandMfr': return [p.brand, p.manufacturer].filter(Boolean).join(' / ')
                  case 'specification': return p.specification || ''
                  case 'unit': return p.unit
                  case 'stock': return p.stock
                  case 'minStock': return p.minStock
                  case 'price': return p.price
                  case 'costPrice': return p.costPrice
                  default: return ''
                }
              }))
              exportExcel('Ton-kho', 'Ton kho', headers, rows)
            }} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 whitespace-nowrap">
              <FileSpreadsheet size={14} /> Excel
            </button>
            <button onClick={() => {
              const vc = COLS_ALL.filter(c => visAll.has(c.key))
              const headers = vc.map(c => c.label)
              const rows = (allProducts || []).map((p: any) => vc.map(c => {
                switch (c.key) {
                  case 'product': return p.name
                  case 'brandMfr': return [p.brand, p.manufacturer].filter(Boolean).join(' / ')
                  case 'specification': return p.specification || ''
                  case 'unit': return p.unit
                  case 'stock': return p.stock
                  case 'minStock': return p.minStock
                  case 'price': return fmt(p.price)
                  case 'costPrice': return fmt(p.costPrice)
                  default: return ''
                }
              }))
              exportPDF('Ton-kho', 'Danh sach ton kho', `Tong: ${allProducts?.length || 0} san pham`, headers, rows)
            }} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 whitespace-nowrap">
              <FileText size={14} /> PDF
            </button>
          </div>
          <div className="card p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    {COLS_ALL.filter(c => visAll.has(c.key)).map(c => (
                      <th key={c.key} className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">{c.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {allProducts?.map((p: any) => (
                    <tr key={p.id} className={`hover:bg-gray-50 ${p.stock <= p.minStock ? 'bg-yellow-50/50' : ''}`}>
                      {visAll.has('product') && <td className="px-4 py-3"><ProductInfo product={p} /></td>}
                      {visAll.has('brandMfr') && (
                        <td className="px-4 py-3">
                          {p.brand && <p className="font-medium text-sm flex items-center gap-1"><Tag size={12} className="text-purple-400" />{p.brand}</p>}
                          {p.manufacturer && <p className="text-xs text-gray-400 flex items-center gap-1"><Building2 size={11} />{p.manufacturer}</p>}
                          {!p.brand && !p.manufacturer && <span className="text-gray-300">—</span>}
                        </td>
                      )}
                      {visAll.has('specification') && <td className="px-4 py-3 text-gray-500 text-xs">{p.specification || '—'}</td>}
                      {visAll.has('unit') && <td className="px-4 py-3 text-gray-500">{p.unit}</td>}
                      {visAll.has('stock') && (
                        <td className="px-4 py-3">
                          <span className={`badge ${p.stock === 0 ? 'badge-red' : p.stock <= p.minStock ? 'badge-yellow' : 'badge-green'}`}>
                            {p.stock}
                          </span>
                        </td>
                      )}
                      {visAll.has('minStock') && <td className="px-4 py-3 text-gray-400">{p.minStock}</td>}
                      {visAll.has('price') && <td className="px-4 py-3 text-blue-600 font-medium whitespace-nowrap">{fmt(p.price)}</td>}
                      {visAll.has('costPrice') && <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{fmt(p.costPrice)}</td>}
                    </tr>
                  ))}
                  {!allProducts?.length && <tr><td colSpan={COLS_ALL.filter(c => visAll.has(c.key)).length} className="text-center py-10 text-gray-400">Không có sản phẩm</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ── Tab: Lịch sử kho ── */}
      {tab === 'logs' && (
        <div className="card p-0 overflow-hidden">
          <div className="px-5 py-3 border-b flex items-center justify-between flex-wrap gap-2">
            <span className="text-sm font-medium text-gray-600">Lịch sử xuất nhập kho</span>
            <div className="flex gap-2 items-center">
              <ColumnPicker cols={COLS_LOGS} visible={visLogs} onChange={setVisLogs} />
              <button onClick={() => {
                const vc = COLS_LOGS.filter(c => visLogs.has(c.key))
                const headers = vc.map(c => c.label)
                const rows = (logs || []).map((l: any) => vc.map(c => {
                  switch (c.key) {
                    case 'product': return l.product?.name || ''
                    case 'type': return logTypeLabel[l.type] || l.type
                    case 'qty': return l.qty
                    case 'before': return l.before
                    case 'after': return l.after
                    case 'note': return l.note || ''
                    case 'createdAt': return new Date(l.createdAt).toLocaleString('vi-VN')
                    default: return ''
                  }
                }))
                exportExcel(`Lich-su-kho_${from}_${to}`, 'Lich su kho', headers, rows)
              }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-medium hover:bg-green-700">
                <FileSpreadsheet size={13} /> Excel
              </button>
              <button onClick={() => {
                const vc = COLS_LOGS.filter(c => visLogs.has(c.key))
                const headers = vc.map(c => c.label)
                const rows = (logs || []).map((l: any) => vc.map(c => {
                  switch (c.key) {
                    case 'product': return l.product?.name || ''
                    case 'type': return logTypeLabel[l.type] || l.type
                    case 'qty': return String(l.qty)
                    case 'before': return String(l.before)
                    case 'after': return String(l.after)
                    case 'note': return l.note || ''
                    case 'createdAt': return new Date(l.createdAt).toLocaleDateString('vi-VN')
                    default: return ''
                  }
                }))
                exportPDF(`Lich-su-kho_${from}_${to}`, 'Lich su xuat nhap kho', fmtPeriod(from, to), headers, rows)
              }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-medium hover:bg-red-700">
                <FileText size={13} /> PDF
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  {COLS_LOGS.filter(c => visLogs.has(c.key)).map(c => (
                    <th key={c.key} className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">{c.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {logs?.map((l: any) => (
                  <tr key={l.id} className="hover:bg-gray-50">
                    {visLogs.has('product') && (
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <ProductThumb product={l.product} />
                          <div>
                            <p className="font-medium">{l.product?.name}</p>
                            {l.product?.brand && (
                              <p className="text-xs text-purple-500 flex items-center gap-0.5"><Tag size={10} />{l.product.brand}</p>
                            )}
                            <p className="text-xs text-gray-400 font-mono">{l.product?.code}</p>
                          </div>
                        </div>
                      </td>
                    )}
                    {visLogs.has('type') && <td className="px-4 py-3"><span className={`badge ${logTypeClass[l.type]}`}>{logTypeLabel[l.type]}</span></td>}
                    {visLogs.has('qty') && <td className="px-4 py-3 font-semibold">{l.qty}</td>}
                    {visLogs.has('before') && <td className="px-4 py-3 text-gray-500">{l.before}</td>}
                    {visLogs.has('after') && <td className="px-4 py-3 text-gray-500">{l.after}</td>}
                    {visLogs.has('note') && <td className="px-4 py-3 text-gray-400 max-w-xs truncate">{l.note || '—'}</td>}
                    {visLogs.has('createdAt') && <td className="px-4 py-3 text-gray-400 whitespace-nowrap text-xs">{new Date(l.createdAt).toLocaleString('vi-VN')}</td>}
                  </tr>
                ))}
                {!logs?.length && <tr><td colSpan={COLS_LOGS.filter(c => visLogs.has(c.key)).length} className="text-center py-10 text-gray-400">Chưa có lịch sử</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Tab: Phiếu nhập ── */}
      {tab === 'purchase' && (
        <div className="card p-0 overflow-hidden">
          <div className="px-5 py-3 border-b flex items-center justify-between flex-wrap gap-2">
            <span className="text-sm font-medium text-gray-600">Danh sách phiếu nhập</span>
            <div className="flex gap-2 items-center">
              <ColumnPicker cols={COLS_PURCHASE} visible={visPurchase} onChange={setVisPurchase} />
              <button onClick={() => {
                const sLabel: any = { COMPLETED: 'Hoàn thành', CANCELLED: 'Đã hủy', PENDING: 'Chờ xử lý' }
                const vc = COLS_PURCHASE.filter(c => visPurchase.has(c.key))
                const headers = vc.map(c => c.label)
                const rows = (purchases?.data || []).map((p: any) => vc.map(c => {
                  switch (c.key) {
                    case 'code': return p.code
                    case 'supplier': return p.supplier?.name || ''
                    case 'total': return p.total
                    case 'paid': return p.paid
                    case 'debt': return p.debt
                    case 'status': return sLabel[p.status] || p.status
                    case 'createdAt': return new Date(p.createdAt).toLocaleDateString('vi-VN')
                    default: return ''
                  }
                }))
                exportExcel(`Phieu-nhap_${from}_${to}`, 'Phieu nhap', headers, rows)
              }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-medium hover:bg-green-700">
                <FileSpreadsheet size={13} /> Excel
              </button>
              <button onClick={() => {
                const sLabel: any = { COMPLETED: 'Hoàn thành', CANCELLED: 'Đã hủy', PENDING: 'Chờ xử lý' }
                const vc = COLS_PURCHASE.filter(c => visPurchase.has(c.key))
                const headers = vc.map(c => c.label)
                const rows = (purchases?.data || []).map((p: any) => vc.map(c => {
                  switch (c.key) {
                    case 'code': return p.code
                    case 'supplier': return p.supplier?.name || ''
                    case 'total': return fmt(p.total)
                    case 'paid': return fmt(p.paid)
                    case 'debt': return fmt(p.debt)
                    case 'status': return sLabel[p.status] || p.status
                    case 'createdAt': return new Date(p.createdAt).toLocaleString('vi-VN')
                    default: return ''
                  }
                }))
                exportPDF(`Phieu-nhap_${from}_${to}`, 'Danh sach phieu nhap hang', fmtPeriod(from, to), headers, rows)
              }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-medium hover:bg-red-700">
                <FileText size={13} /> PDF
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  {COLS_PURCHASE.filter(c => visPurchase.has(c.key)).map(c => (
                    <th key={c.key} className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">{c.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {purchases?.data?.map((p: any) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    {visPurchase.has('code') && (
                      <td className="px-4 py-3">
                        <button onClick={() => setViewPurchase(p)} className="font-mono text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline">
                          {p.code}
                        </button>
                      </td>
                    )}
                    {visPurchase.has('supplier') && <td className="px-4 py-3">{p.supplier?.name}</td>}
                    {visPurchase.has('total') && <td className="px-4 py-3 font-semibold whitespace-nowrap">{fmt(p.total)}</td>}
                    {visPurchase.has('paid') && <td className="px-4 py-3 text-green-600 whitespace-nowrap">{fmt(p.paid)}</td>}
                    {visPurchase.has('debt') && <td className="px-4 py-3 text-red-500 whitespace-nowrap">{fmt(p.debt)}</td>}
                    {visPurchase.has('status') && (
                      <td className="px-4 py-3">
                        <span className={`badge ${p.status === 'COMPLETED' ? 'badge-green' : p.status === 'CANCELLED' ? 'badge-red' : 'badge-yellow'}`}>
                          {p.status === 'COMPLETED' ? 'Hoàn thành' : p.status === 'CANCELLED' ? 'Đã hủy' : 'Chờ xử lý'}
                        </span>
                      </td>
                    )}
                    {visPurchase.has('createdAt') && <td className="px-4 py-3 text-gray-400 whitespace-nowrap text-xs">{new Date(p.createdAt).toLocaleString('vi-VN')}</td>}
                  </tr>
                ))}
                {!purchases?.data?.length && <tr><td colSpan={COLS_PURCHASE.filter(c => visPurchase.has(c.key)).length} className="text-center py-10 text-gray-400">Chưa có phiếu nhập</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ==================== Modal Điều chỉnh kho ==================== */}
      {showAdjust && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold">Điều chỉnh tồn kho</h2>
              <button onClick={() => setShowAdjust(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <form onSubmit={e => { e.preventDefault(); adjust.mutate(adjustForm) }} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Chọn sản phẩm *</label>
                <select className="input" value={adjustForm.productId}
                  onChange={e => {
                    const p = products?.find((x: any) => x.id === e.target.value)
                    setAdjustForm(f => ({ ...f, productId: e.target.value, newStock: p?.stock || 0 }))
                  }} required>
                  <option value="">-- Chọn sản phẩm --</option>
                  {products?.map((p: any) => <option key={p.id} value={p.id}>{p.name} [{p.code}] — Tồn: {p.stock}</option>)}
                </select>
              </div>

              {/* Thông tin sản phẩm đã chọn */}
              {selectedAdjustProduct && (
                <div className="bg-gray-50 rounded-xl p-3 flex items-center gap-3">
                  <ProductThumb product={selectedAdjustProduct} size="md" />
                  <div className="min-w-0">
                    <p className="font-semibold">{selectedAdjustProduct.name}</p>
                    <div className="flex gap-2 flex-wrap mt-0.5">
                      {selectedAdjustProduct.brand && <span className="text-xs text-purple-600 flex items-center gap-0.5"><Tag size={10} />{selectedAdjustProduct.brand}</span>}
                      {selectedAdjustProduct.manufacturer && <span className="text-xs text-gray-400 flex items-center gap-0.5"><Building2 size={10} />{selectedAdjustProduct.manufacturer}</span>}
                    </div>
                    {selectedAdjustProduct.specification && <p className="text-xs text-gray-400 mt-0.5">{selectedAdjustProduct.specification}</p>}
                    <p className="text-xs text-gray-500 mt-1">Tồn hiện tại: <strong>{selectedAdjustProduct.stock} {selectedAdjustProduct.unit}</strong></p>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-1">Tồn kho thực tế *</label>
                <input className="input" type="number" min="0" value={adjustForm.newStock}
                  onChange={e => setAdjustForm(f => ({ ...f, newStock: +e.target.value }))} required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Lý do điều chỉnh</label>
                <input className="input" placeholder="VD: Kiểm kê thực tế, mất hàng..."
                  value={adjustForm.note} onChange={e => setAdjustForm(f => ({ ...f, note: e.target.value }))} />
              </div>
              <div className="flex gap-3 justify-end pt-2">
                <button type="button" onClick={() => setShowAdjust(false)} className="btn-outline">Hủy</button>
                <button type="submit" disabled={adjust.isPending} className="btn-primary">
                  {adjust.isPending ? 'Đang lưu...' : 'Xác nhận'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== Modal Nhập hàng ==================== */}
      {showPurchase && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b flex justify-between items-center flex-shrink-0">
              <h2 className="text-lg font-bold">Phiếu nhập hàng</h2>
              <button onClick={() => setShowPurchase(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <form onSubmit={e => { e.preventDefault(); purchase.mutate(purchaseForm) }} className="overflow-y-auto p-6 space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm font-medium">Nhà cung cấp *</label>
                  <button type="button" onClick={() => setShowNewSupplier(true)}
                    className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors">
                    <Plus size={13} /> Tạo mới
                  </button>
                </div>
                <select className="input" value={purchaseForm.supplierId}
                  onChange={e => setPurchaseForm(p => ({ ...p, supplierId: e.target.value }))} required>
                  <option value="">-- Chọn nhà cung cấp --</option>
                  {suppliers?.map((s: any) => <option key={s.id} value={s.id}>{s.name}{s.phone ? ` — ${s.phone}` : ''}</option>)}
                </select>
              </div>

              {/* Danh sách sản phẩm nhập */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm font-medium">Sản phẩm nhập kho</label>
                  <button type="button" onClick={addPurchaseItem}
                    className="text-blue-600 text-sm hover:text-blue-700 font-medium">+ Thêm dòng</button>
                </div>
                <div className="space-y-3">
                  {purchaseForm.items.map((item, i) => {
                    const selectedProd = products?.find((p: any) => p.id === item.productId)
                    return (
                      <div key={i} className="border rounded-xl p-3 space-y-2">
                        <div className="flex items-start gap-2">
                          <div className="flex-1">
                            <select className="input text-sm"
                              value={item.productId}
                              onChange={e => {
                                const p = products?.find((x: any) => x.id === e.target.value)
                                updatePurchaseItem(i, 'productId', e.target.value)
                                if (p) updatePurchaseItem(i, 'costPrice', p.costPrice)
                              }} required>
                              <option value="">-- Chọn sản phẩm --</option>
                              {products?.map((p: any) => <option key={p.id} value={p.id}>{p.name} [{p.code}]</option>)}
                            </select>
                          </div>
                          <button type="button" title="Tạo sản phẩm mới"
                            onClick={() => setNewProductForItemIdx(i)}
                            className="flex-shrink-0 flex items-center gap-1 px-2 py-2 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors whitespace-nowrap mt-0.5">
                            <PackagePlus size={14} /> Tạo mới
                          </button>
                          {purchaseForm.items.length > 1 && (
                            <button type="button" onClick={() => removePurchaseItem(i)}
                              className="text-red-400 hover:text-red-600 mt-1.5 flex-shrink-0"><X size={16} /></button>
                          )}
                        </div>

                        {/* Thông tin sản phẩm được chọn */}
                        {selectedProd && (
                          <div className="bg-gray-50 rounded-lg px-3 py-2 flex items-center gap-2">
                            <ProductThumb product={selectedProd} />
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap gap-2">
                                {selectedProd.brand && <span className="text-xs text-purple-600 flex items-center gap-0.5"><Tag size={10} />{selectedProd.brand}</span>}
                                {selectedProd.manufacturer && <span className="text-xs text-gray-400 flex items-center gap-0.5"><Building2 size={10} />{selectedProd.manufacturer}</span>}
                              </div>
                              {selectedProd.specification && <p className="text-xs text-gray-400">{selectedProd.specification}</p>}
                              <p className="text-xs text-gray-500">Tồn kho: <strong>{selectedProd.stock} {selectedProd.unit}</strong> · Giá vốn hiện tại: {fmt(selectedProd.costPrice)}</p>
                            </div>
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-xs text-gray-500 mb-1 block">Số lượng nhập *</label>
                            <input className="input text-sm" type="number" min="1" placeholder="SL"
                              value={item.qty} onChange={e => updatePurchaseItem(i, 'qty', +e.target.value)} required />
                          </div>
                          <div>
                            <label className="text-xs text-gray-500 mb-1 block">Giá nhập (đ) *</label>
                            <input className="input text-sm" type="number" min="0" placeholder="Giá nhập"
                              value={item.costPrice} onChange={e => updatePurchaseItem(i, 'costPrice', +e.target.value)} required />
                          </div>
                        </div>
                        {item.qty > 0 && item.costPrice > 0 && (
                          <p className="text-xs text-right text-blue-600 font-medium">
                            Thành tiền: {fmt(item.qty * item.costPrice)}
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Tổng & thanh toán */}
              <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
                <div className="flex justify-between font-bold text-base">
                  <span>Tổng giá trị nhập</span>
                  <span className="text-blue-600">{fmt(purchaseTotal)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <label className="text-gray-600">Đã trả ngay</label>
                  <input type="number" min="0" max={purchaseTotal}
                    className="input text-sm text-right w-40"
                    value={purchaseForm.paid}
                    onChange={e => setPurchaseForm(p => ({ ...p, paid: +e.target.value }))} />
                </div>
                {purchaseTotal - purchaseForm.paid > 0 && (
                  <div className="flex justify-between text-red-500 font-medium">
                    <span>Còn nợ NCC</span>
                    <span>{fmt(purchaseTotal - purchaseForm.paid)}</span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Ghi chú</label>
                <input className="input" placeholder="Ghi chú phiếu nhập..."
                  value={purchaseForm.note} onChange={e => setPurchaseForm(p => ({ ...p, note: e.target.value }))} />
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <button type="button" onClick={() => setShowPurchase(false)} className="btn-outline">Hủy</button>
                <button type="submit" disabled={purchase.isPending} className="btn-primary px-6">
                  {purchase.isPending ? 'Đang lưu...' : 'Xác nhận nhập kho'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== Modal chi tiết phiếu nhập ==================== */}
      {viewPurchase && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setViewPurchase(null)}>
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="px-6 py-4 border-b flex items-center justify-between flex-shrink-0">
              <div>
                <h2 className="text-lg font-bold">Chi tiết phiếu nhập</h2>
                <p className="text-sm font-mono text-blue-600 mt-0.5">{viewPurchase.code}</p>
              </div>
              <button onClick={() => setViewPurchase(null)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>

            <div className="overflow-y-auto p-6 space-y-5">
              {/* Thông tin chung */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="bg-gray-50 rounded-xl p-3 space-y-1.5">
                  <p className="text-gray-500 text-xs font-medium uppercase tracking-wide">Nhà cung cấp</p>
                  <p className="font-semibold">{viewPurchase.supplier?.name}</p>
                  {viewPurchase.supplier?.phone && <p className="text-gray-500 text-xs">{viewPurchase.supplier.phone}</p>}
                </div>
                <div className="bg-gray-50 rounded-xl p-3 space-y-1.5">
                  <p className="text-gray-500 text-xs font-medium uppercase tracking-wide">Ngày nhập</p>
                  <p className="font-semibold">{new Date(viewPurchase.createdAt).toLocaleString('vi-VN')}</p>
                  <span className={`badge text-xs ${viewPurchase.status === 'COMPLETED' ? 'badge-green' : viewPurchase.status === 'CANCELLED' ? 'badge-red' : 'badge-yellow'}`}>
                    {viewPurchase.status === 'COMPLETED' ? 'Hoàn thành' : viewPurchase.status === 'CANCELLED' ? 'Đã hủy' : 'Chờ xử lý'}
                  </span>
                </div>
              </div>

              {/* Danh sách sản phẩm */}
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-2">Danh sách sản phẩm nhập</p>
                <div className="border rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        {['Sản phẩm', 'Đơn vị', 'SL nhập', 'Giá nhập', 'Thành tiền'].map(h => (
                          <th key={h} className="px-3 py-2.5 text-left font-medium text-gray-600 whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {viewPurchase.items?.map((item: any) => (
                        <tr key={item.id} className="hover:bg-gray-50">
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-2">
                              <ProductThumb product={item.product} />
                              <div>
                                <p className="font-medium">{item.product?.name}</p>
                                <p className="text-xs font-mono text-gray-400">{item.product?.code}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-gray-500">{item.product?.unit}</td>
                          <td className="px-3 py-2.5 font-semibold">{item.qty}</td>
                          <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{fmt(item.costPrice)}</td>
                          <td className="px-3 py-2.5 font-semibold text-blue-600 whitespace-nowrap">{fmt(item.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Tổng kết thanh toán */}
              <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
                <div className="flex justify-between font-bold text-base">
                  <span>Tổng giá trị nhập</span>
                  <span className="text-blue-600">{fmt(viewPurchase.total)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Đã trả</span>
                  <span className="text-green-600 font-medium">{fmt(viewPurchase.paid)}</span>
                </div>
                {viewPurchase.debt > 0 && (
                  <div className="flex justify-between font-medium text-red-500 pt-1 border-t border-gray-200">
                    <span>Còn nợ NCC</span>
                    <span>{fmt(viewPurchase.debt)}</span>
                  </div>
                )}
              </div>

              {/* Ghi chú */}
              {viewPurchase.note && (
                <div className="text-sm">
                  <p className="text-gray-500 font-medium mb-1">Ghi chú</p>
                  <p className="text-gray-700 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2">{viewPurchase.note}</p>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t flex-shrink-0 flex justify-end">
              <button onClick={() => setViewPurchase(null)} className="btn-outline px-6">Đóng</button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== Modal tạo nhà cung cấp mới ==================== */}
      {showNewSupplier && (
        <NewSupplierModal
          onClose={() => setShowNewSupplier(false)}
          onCreated={(supplier) => {
            setPurchaseForm(p => ({ ...p, supplierId: supplier.id }))
            setShowNewSupplier(false)
          }}
        />
      )}

      {/* ==================== Modal tạo sản phẩm mới từ phiếu nhập ==================== */}
      {newProductForItemIdx !== null && (
        <NewProductModal
          defaultSupplierId={purchaseForm.supplierId}
          onClose={() => setNewProductForItemIdx(null)}
          onCreated={(product) => {
            const idx = newProductForItemIdx
            updatePurchaseItem(idx, 'productId', product.id)
            updatePurchaseItem(idx, 'costPrice', product.costPrice)
            qc.invalidateQueries({ queryKey: ['products-all'] })
            setNewProductForItemIdx(null)
          }}
        />
      )}
    </div>
  )
}

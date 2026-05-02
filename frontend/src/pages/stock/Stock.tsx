import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../../services/api'
import toast from 'react-hot-toast'
import { AlertTriangle, Plus, Package, Tag, Building2, X, PackagePlus, FileSpreadsheet, FileText, Search, Printer } from 'lucide-react'
import { exportExcel, exportPDF, PRESETS, fmtPeriod } from '../../utils/export'
import NewProductModal from '../products/NewProductModal'
import NewSupplierModal from '../suppliers/NewSupplierModal'
import ColumnPicker, { ColDef } from '../../components/ColumnPicker'

const fmt = (n: number) => new Intl.NumberFormat('vi-VN').format(n) + 'đ'
const PAY_LABEL: any = { CASH: 'Tiền mặt', CARD: 'Thẻ ngân hàng', TRANSFER: 'Chuyển khoản', DEBT: 'Ghi nợ', MIXED: 'Hỗn hợp' }

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
  { key: 'code', label: 'Mã SP' },
  { key: 'brandMfr', label: 'Thương hiệu / CTSX' },
  { key: 'packageUnit', label: 'ĐVT thùng' },
  { key: 'packageQty', label: 'SL/thùng' },
  { key: 'unit', label: 'ĐVT lẻ' },
  { key: 'stockBoxes', label: 'Tồn (thùng)' },
  { key: 'stockRem', label: 'Tồn (lẻ)' },
  { key: 'stock', label: 'Tổng tồn' },
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
const COLS_EXPORT: ColDef[] = [
  { key: 'orderCode', label: 'Mã đơn hàng' },
  { key: 'customer', label: 'Khách hàng' },
  { key: 'orderStatus', label: 'Trạng thái đơn' },
  { key: 'itemCount', label: 'Số SP' },
  { key: 'total', label: 'Tổng tiền' },
  { key: 'paymentMethod', label: 'Thanh toán' },
  { key: 'warehouseStatus', label: 'Trạng thái xuất kho' },
  { key: 'user', label: 'Nhân viên' },
  { key: 'createdAt', label: 'Ngày xuất' },
]

const WH_LABEL: Record<string, string> = { PENDING: 'Chưa xuất', EXPORTING: 'Đang xuất', EXPORTED: 'Đã xuất' }

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
  const [tab, setTab] = useState<'low' | 'all' | 'logs' | 'purchase' | 'export'>('low')
  const [viewPurchase, setViewPurchase] = useState<any>(null)
  const now2 = new Date()
  const _ld = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const [from, setFrom] = useState(_ld(new Date(now2.getFullYear(), now2.getMonth(), 1)))
  const [to, setTo] = useState(_ld(now2))
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
  const [searchExport, setSearchExport] = useState('')
  const [filterWhStatus, setFilterWhStatus] = useState('')
  const [selectedExportIds, setSelectedExportIds] = useState<Set<string>>(new Set())
  const [selectedAllIds, setSelectedAllIds] = useState<Set<string>>(new Set())
  const [exportSlipMode, setExportSlipMode] = useState<'total' | 'detail' | null>(null)
  const [visExport, setVisExport] = useState<Set<string>>(() => new Set(COLS_EXPORT.map(c => c.key)))
  const exportSlipRef = useRef<HTMLDivElement>(null)
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
  const { data: exportOrders } = useQuery({
    queryKey: ['export-orders', from, to],
    queryFn: () => api.get(`/orders?from=${from}&to=${to}&limit=500`).then(r => r.data),
    enabled: tab === 'export'
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

  const updateWhStatus = useMutation({
    mutationFn: ({ id, warehouseStatus }: { id: string; warehouseStatus: string }) =>
      api.patch(`/orders/${id}/warehouse-status`, { warehouseStatus }).then(r => r.data),
    onSuccess: () => {
      toast.success('Đã cập nhật trạng thái xuất kho')
      qc.invalidateQueries({ queryKey: ['export-orders'] })
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Lỗi cập nhật')
  })

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

  const filteredLogs = (logs || []).filter((l: any) => {
    if (!searchLogs) return true
    const q = searchLogs.toLowerCase()
    return (l.product?.name || '').toLowerCase().includes(q) ||
      (l.product?.code || '').toLowerCase().includes(q) ||
      (l.note || '').toLowerCase().includes(q)
  })

  const filteredPurchases = (purchases?.data || []).filter((p: any) => {
    if (!searchPurchase) return true
    const q = searchPurchase.toLowerCase()
    return p.code.toLowerCase().includes(q) ||
      (p.supplier?.name || '').toLowerCase().includes(q)
  })

  const filteredExportOrders = (exportOrders?.data || []).filter((o: any) => {
    if (o.status === 'CANCELLED' || o.status === 'REFUNDED') return false
    if (filterWhStatus && (o.warehouseStatus || 'PENDING') !== filterWhStatus) return false
    if (!searchExport) return true
    const q = searchExport.toLowerCase()
    return o.orderCode.toLowerCase().includes(q) ||
      (o.customer?.name || '').toLowerCase().includes(q) ||
      (o.customer?.phone || '').toLowerCase().includes(q) ||
      (o.user?.name || '').toLowerCase().includes(q)
  })

  const selectedExportOrders = filteredExportOrders.filter((o: any) => selectedExportIds.has(o.id))

  const mergedItemsForTotal = (() => {
    const map = new Map<string, { product: any; qty: number; price: number }>()
    selectedExportOrders.forEach((o: any) => {
      o.items?.forEach((item: any) => {
        const key = item.productId
        if (map.has(key)) {
          map.get(key)!.qty += item.qty
        } else {
          map.set(key, { product: item.product, qty: item.qty, price: item.price })
        }
      })
    })
    return Array.from(map.values())
  })()

  const exportLogs = selectedLogIds.size > 0
    ? filteredLogs.filter((l: any) => selectedLogIds.has(l.id))
    : filteredLogs

  const exportPurchases = selectedPurchaseIds.size > 0
    ? filteredPurchases.filter((p: any) => selectedPurchaseIds.has(p.id))
    : filteredPurchases

  const purchaseTotal = purchaseForm.items.reduce((s, i) => s + i.qty * i.costPrice, 0)

  const getAllVal = (p: any, key: string) => {
    const pQty = p.packageQty || 0
    switch (key) {
      case 'product': return p.name
      case 'code': return p.code
      case 'brandMfr': return [p.brand, p.manufacturer].filter(Boolean).join(' / ') || ''
      case 'packageUnit': return p.packageUnit || ''
      case 'packageQty': return pQty || ''
      case 'unit': return p.unit
      case 'stockBoxes': return pQty > 0 ? Math.floor(p.stock / pQty) : ''
      case 'stockRem': return pQty > 0 ? p.stock % pQty : p.stock
      case 'stock': return p.stock
      case 'minStock': return p.minStock
      case 'price': return p.price
      case 'costPrice': return p.costPrice
      default: return ''
    }
  }

  const visibleAllProducts = selectedAllIds.size > 0
    ? (allProducts || []).filter((p: any) => selectedAllIds.has(p.id))
    : (allProducts || [])

  const allTotals = (allProducts || []).reduce((acc: any, p: any) => {
    const pQty = p.packageQty || 0
    acc.totalSkus += 1
    acc.totalUnits += p.stock
    acc.totalBoxes += pQty > 0 ? Math.floor(p.stock / pQty) : 0
    acc.stockValue += p.stock * p.costPrice
    return acc
  }, { totalSkus: 0, totalUnits: 0, totalBoxes: 0, stockValue: 0 })

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
      <div className="flex gap-1.5 flex-wrap">
        {[['low', 'Hàng sắp hết'], ['all', 'Tất cả sản phẩm'], ['logs', 'Lịch sử kho'], ['purchase', 'Phiếu nhập'], ['export', 'Phiếu xuất']].map(([val, label]) => (
          <button key={val} onClick={() => setTab(val as any)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === val ? 'bg-blue-600 text-white' : 'bg-white border hover:bg-gray-50'}`}>
            {label}
            {val === 'low' && lowStockData?.length > 0 && (
              <span className="ml-1.5 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5">{lowStockData.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* Bộ lọc thời gian — hiện cho Lịch sử kho, Phiếu nhập và Phiếu xuất */}
      {(tab === 'logs' || tab === 'purchase' || tab === 'export') && (
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
          {/* Thanh tổng hợp kho */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: 'Tổng mã hàng', value: allTotals.totalSkus, unit: 'SKU', color: 'text-blue-600', bg: 'bg-blue-50' },
              { label: 'Tổng tồn kho', value: new Intl.NumberFormat('vi-VN').format(allTotals.totalUnits), unit: 'đơn vị lẻ', color: 'text-green-600', bg: 'bg-green-50' },
              { label: 'Quy đổi thùng', value: new Intl.NumberFormat('vi-VN').format(allTotals.totalBoxes), unit: 'thùng', color: 'text-orange-600', bg: 'bg-orange-50' },
              { label: 'Giá trị tồn kho', value: fmt(allTotals.stockValue), unit: '(theo giá vốn)', color: 'text-purple-600', bg: 'bg-purple-50' },
            ].map(s => (
              <div key={s.label} className={`card flex items-center gap-3 py-3 ${s.bg}`}>
                <div>
                  <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-gray-500">{s.label} <span className="text-gray-400">({s.unit})</span></p>
                </div>
              </div>
            ))}
          </div>

          {/* Toolbar */}
          <div className="flex gap-2 items-center flex-wrap">
            <div className="relative flex-1 min-w-48">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input className="input pl-9" placeholder="Tìm theo tên, mã, thương hiệu..."
                value={searchAll} onChange={e => { setSearchAll(e.target.value); setSelectedAllIds(new Set()) }} />
            </div>
            {selectedAllIds.size > 0 && (
              <>
                <span className="text-sm text-blue-600 font-medium whitespace-nowrap">Đã chọn {selectedAllIds.size}</span>
                <button onClick={() => setSelectedAllIds(new Set())} className="text-xs text-gray-400 hover:text-gray-600 underline whitespace-nowrap">Bỏ chọn</button>
              </>
            )}
            <ColumnPicker cols={COLS_ALL} visible={visAll} onChange={setVisAll} />
            <button onClick={() => {
              const vc = COLS_ALL.filter(c => visAll.has(c.key))
              const rows = visibleAllProducts.map((p: any) => vc.map(c => getAllVal(p, c.key)))
              exportExcel(`Ton-kho_${new Date().toISOString().slice(0,10)}`, 'Tồn kho', vc.map(c => c.label), rows)
            }} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 whitespace-nowrap">
              <FileSpreadsheet size={14} /> {selectedAllIds.size > 0 ? `Excel (${selectedAllIds.size})` : 'Excel'}
            </button>
            <button onClick={() => {
              const vc = COLS_ALL.filter(c => visAll.has(c.key))
              const rows = visibleAllProducts.map((p: any) => vc.map(c => {
                const v = getAllVal(p, c.key)
                return (c.key === 'price' || c.key === 'costPrice') && typeof v === 'number' ? fmt(v) : v
              }))
              exportPDF(`Ton-kho_${new Date().toISOString().slice(0,10)}`, 'Danh sách tồn kho', `Tổng: ${allProducts?.length || 0} sản phẩm | Giá trị: ${fmt(allTotals.stockValue)}`, vc.map(c => c.label), rows)
            }} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 whitespace-nowrap">
              <FileText size={14} /> {selectedAllIds.size > 0 ? `PDF (${selectedAllIds.size})` : 'PDF'}
            </button>
          </div>

          <div className="card p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-3 py-3 w-10">
                      <input type="checkbox" className="w-4 h-4 rounded cursor-pointer accent-blue-600"
                        checked={(allProducts?.length ?? 0) > 0 && (allProducts || []).every((p: any) => selectedAllIds.has(p.id))}
                        onChange={e => {
                          const ids = (allProducts || []).map((p: any) => p.id)
                          if (e.target.checked) setSelectedAllIds(new Set(ids))
                          else setSelectedAllIds(new Set())
                        }} />
                    </th>
                    {COLS_ALL.filter(c => visAll.has(c.key)).map(c => (
                      <th key={c.key} className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">{c.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {(allProducts || []).map((p: any) => {
                    const pQty = p.packageQty || 0
                    const boxes = pQty > 0 ? Math.floor(p.stock / pQty) : null
                    const rem = pQty > 0 ? p.stock % pQty : p.stock
                    const isLow = p.stock <= p.minStock
                    return (
                      <tr key={p.id} className={`hover:bg-gray-50 ${selectedAllIds.has(p.id) ? 'bg-blue-50' : isLow ? 'bg-yellow-50/50' : ''}`}>
                        <td className="px-3 py-2">
                          <input type="checkbox" className="w-4 h-4 rounded cursor-pointer accent-blue-600"
                            checked={selectedAllIds.has(p.id)}
                            onChange={e => setSelectedAllIds(prev => { const s = new Set(prev); e.target.checked ? s.add(p.id) : s.delete(p.id); return s })} />
                        </td>
                        {visAll.has('product') && <td className="px-4 py-3"><ProductInfo product={p} /></td>}
                        {visAll.has('code') && <td className="px-4 py-3 font-mono text-xs text-gray-500">{p.code}</td>}
                        {visAll.has('brandMfr') && (
                          <td className="px-4 py-3">
                            {p.brand && <p className="font-medium text-sm flex items-center gap-1"><Tag size={12} className="text-purple-400" />{p.brand}</p>}
                            {p.manufacturer && <p className="text-xs text-gray-400 flex items-center gap-1"><Building2 size={11} />{p.manufacturer}</p>}
                            {!p.brand && !p.manufacturer && <span className="text-gray-300">—</span>}
                          </td>
                        )}
                        {visAll.has('packageUnit') && <td className="px-4 py-3 text-gray-500 text-center">{p.packageUnit || <span className="text-gray-300">—</span>}</td>}
                        {visAll.has('packageQty') && <td className="px-4 py-3 text-gray-500 text-center">{pQty || <span className="text-gray-300">—</span>}</td>}
                        {visAll.has('unit') && <td className="px-4 py-3 text-gray-500">{p.unit}</td>}
                        {visAll.has('stockBoxes') && (
                          <td className="px-4 py-3 text-right font-semibold">
                            {boxes !== null ? <span className="text-gray-800">{boxes}</span> : <span className="text-gray-300">—</span>}
                          </td>
                        )}
                        {visAll.has('stockRem') && (
                          <td className="px-4 py-3 text-right font-semibold">
                            <span className={rem === 0 ? 'text-gray-400' : 'text-gray-800'}>{rem}</span>
                          </td>
                        )}
                        {visAll.has('stock') && (
                          <td className="px-4 py-3 text-right">
                            <span className={`badge ${p.stock === 0 ? 'badge-red' : isLow ? 'badge-yellow' : 'badge-green'}`}>{p.stock}</span>
                          </td>
                        )}
                        {visAll.has('minStock') && <td className="px-4 py-3 text-gray-400 text-right">{p.minStock}</td>}
                        {visAll.has('price') && <td className="px-4 py-3 text-blue-600 font-medium whitespace-nowrap text-right">{fmt(p.price)}</td>}
                        {visAll.has('costPrice') && <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-right">{fmt(p.costPrice)}</td>}
                      </tr>
                    )
                  })}
                  {!allProducts?.length && (
                    <tr><td colSpan={COLS_ALL.filter(c => visAll.has(c.key)).length + 1} className="text-center py-10 text-gray-400">Không có sản phẩm</td></tr>
                  )}
                </tbody>
                {(allProducts?.length ?? 0) > 0 && (
                  <tfoot className="bg-gray-50 border-t font-semibold text-sm">
                    <tr>
                      <td colSpan={COLS_ALL.filter(c => visAll.has(c.key) && !['stockBoxes','stockRem','stock','minStock','price','costPrice'].includes(c.key)).length + 1} className="px-4 py-3 text-gray-600">
                        Tổng ({allProducts?.length} mã hàng)
                      </td>
                      {visAll.has('stockBoxes') && <td className="px-4 py-3 text-right text-orange-600">{new Intl.NumberFormat('vi-VN').format(allTotals.totalBoxes)}</td>}
                      {visAll.has('stockRem') && <td className="px-4 py-3 text-right text-gray-500">—</td>}
                      {visAll.has('stock') && <td className="px-4 py-3 text-right text-green-700">{new Intl.NumberFormat('vi-VN').format(allTotals.totalUnits)}</td>}
                      {visAll.has('minStock') && <td />}
                      {visAll.has('price') && <td />}
                      {visAll.has('costPrice') && <td className="px-4 py-3 text-right text-purple-600">{fmt(allTotals.stockValue)}</td>}
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </>
      )}

      {/* ── Tab: Lịch sử kho ── */}
      {tab === 'logs' && (
        <div className="card p-0 overflow-hidden">
          <div className="px-5 py-3 border-b flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-sm font-medium text-gray-600">Lịch sử xuất nhập kho</span>
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input className="input pl-8 py-1.5 text-sm w-56"
                  placeholder="Tìm sản phẩm, mã, ghi chú..."
                  value={searchLogs} onChange={e => { setSearchLogs(e.target.value); setSelectedLogIds(new Set()) }} />
              </div>
              {selectedLogIds.size > 0 && (
                <>
                  <span className="text-sm text-blue-600 font-medium">Đã chọn {selectedLogIds.size}</span>
                  <button onClick={() => setSelectedLogIds(new Set())} className="text-xs text-gray-400 hover:text-gray-600 underline">Bỏ chọn</button>
                </>
              )}
            </div>
            <div className="flex gap-2 items-center">
              <ColumnPicker cols={COLS_LOGS} visible={visLogs} onChange={setVisLogs} />
              <button onClick={() => {
                const vc = COLS_LOGS.filter(c => visLogs.has(c.key))
                const rows = exportLogs.map((l: any) => vc.map(c => {
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
                exportExcel(`Lich-su-kho_${from}_${to}`, 'Lich su kho', vc.map(c => c.label), rows)
              }} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-xs font-medium ${selectedLogIds.size > 0 ? 'bg-green-700' : 'bg-green-600 hover:bg-green-700'}`}>
                <FileSpreadsheet size={13} /> {selectedLogIds.size > 0 ? `Excel (${selectedLogIds.size})` : 'Excel'}
              </button>
              <button onClick={() => {
                const vc = COLS_LOGS.filter(c => visLogs.has(c.key))
                const rows = exportLogs.map((l: any) => vc.map(c => {
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
                exportPDF(`Lich-su-kho_${from}_${to}`, 'Lich su xuat nhap kho', fmtPeriod(from, to), vc.map(c => c.label), rows)
              }} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-xs font-medium ${selectedLogIds.size > 0 ? 'bg-red-700' : 'bg-red-600 hover:bg-red-700'}`}>
                <FileText size={13} /> {selectedLogIds.size > 0 ? `PDF (${selectedLogIds.size})` : 'PDF'}
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-3 py-3 w-10">
                    <input type="checkbox" className="w-4 h-4 rounded cursor-pointer accent-blue-600"
                      checked={filteredLogs.length > 0 && filteredLogs.every((l: any) => selectedLogIds.has(l.id))}
                      onChange={e => {
                        const ids = filteredLogs.map((l: any) => l.id)
                        if (e.target.checked) setSelectedLogIds(prev => new Set([...prev, ...ids]))
                        else setSelectedLogIds(prev => { const s = new Set(prev); ids.forEach((id: string) => s.delete(id)); return s })
                      }}
                    />
                  </th>
                  {COLS_LOGS.filter(c => visLogs.has(c.key)).map(c => (
                    <th key={c.key} className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">{c.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredLogs.map((l: any) => (
                  <tr key={l.id} className={`hover:bg-gray-50 ${selectedLogIds.has(l.id) ? 'bg-blue-50' : ''}`}>
                    <td className="px-3 py-2">
                      <input type="checkbox" className="w-4 h-4 rounded cursor-pointer accent-blue-600"
                        checked={selectedLogIds.has(l.id)}
                        onChange={e => setSelectedLogIds(prev => {
                          const s = new Set(prev); e.target.checked ? s.add(l.id) : s.delete(l.id); return s
                        })}
                      />
                    </td>
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
                {!filteredLogs.length && (
                  <tr><td colSpan={COLS_LOGS.filter(c => visLogs.has(c.key)).length + 1} className="text-center py-10 text-gray-400">
                    {searchLogs ? 'Không tìm thấy kết quả' : 'Chưa có lịch sử'}
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Tab: Phiếu nhập ── */}
      {tab === 'purchase' && (
        <div className="card p-0 overflow-hidden">
          <div className="px-5 py-3 border-b flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-sm font-medium text-gray-600">Danh sách phiếu nhập</span>
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input className="input pl-8 py-1.5 text-sm w-52"
                  placeholder="Tìm mã phiếu, nhà cung cấp..."
                  value={searchPurchase} onChange={e => { setSearchPurchase(e.target.value); setSelectedPurchaseIds(new Set()) }} />
              </div>
              {selectedPurchaseIds.size > 0 && (
                <>
                  <span className="text-sm text-blue-600 font-medium">Đã chọn {selectedPurchaseIds.size}</span>
                  <button onClick={() => setSelectedPurchaseIds(new Set())} className="text-xs text-gray-400 hover:text-gray-600 underline">Bỏ chọn</button>
                </>
              )}
            </div>
            <div className="flex gap-2 items-center">
              <ColumnPicker cols={COLS_PURCHASE} visible={visPurchase} onChange={setVisPurchase} />
              <button onClick={() => {
                const sLabel: any = { COMPLETED: 'Hoàn thành', CANCELLED: 'Đã hủy', PENDING: 'Chờ xử lý' }
                const vc = COLS_PURCHASE.filter(c => visPurchase.has(c.key))
                const rows = exportPurchases.map((p: any) => vc.map(c => {
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
                exportExcel(`Phieu-nhap_${from}_${to}`, 'Phieu nhap', vc.map(c => c.label), rows)
              }} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-xs font-medium ${selectedPurchaseIds.size > 0 ? 'bg-green-700' : 'bg-green-600 hover:bg-green-700'}`}>
                <FileSpreadsheet size={13} /> {selectedPurchaseIds.size > 0 ? `Excel (${selectedPurchaseIds.size})` : 'Excel'}
              </button>
              <button onClick={() => {
                const sLabel: any = { COMPLETED: 'Hoàn thành', CANCELLED: 'Đã hủy', PENDING: 'Chờ xử lý' }
                const vc = COLS_PURCHASE.filter(c => visPurchase.has(c.key))
                const rows = exportPurchases.map((p: any) => vc.map(c => {
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
                exportPDF(`Phieu-nhap_${from}_${to}`, 'Danh sach phieu nhap hang', fmtPeriod(from, to), vc.map(c => c.label), rows)
              }} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-xs font-medium ${selectedPurchaseIds.size > 0 ? 'bg-red-700' : 'bg-red-600 hover:bg-red-700'}`}>
                <FileText size={13} /> {selectedPurchaseIds.size > 0 ? `PDF (${selectedPurchaseIds.size})` : 'PDF'}
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-3 py-3 w-10">
                    <input type="checkbox" className="w-4 h-4 rounded cursor-pointer accent-blue-600"
                      checked={filteredPurchases.length > 0 && filteredPurchases.every((p: any) => selectedPurchaseIds.has(p.id))}
                      onChange={e => {
                        const ids = filteredPurchases.map((p: any) => p.id)
                        if (e.target.checked) setSelectedPurchaseIds(prev => new Set([...prev, ...ids]))
                        else setSelectedPurchaseIds(prev => { const s = new Set(prev); ids.forEach((id: string) => s.delete(id)); return s })
                      }}
                    />
                  </th>
                  {COLS_PURCHASE.filter(c => visPurchase.has(c.key)).map(c => (
                    <th key={c.key} className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">{c.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredPurchases.map((p: any) => (
                  <tr key={p.id} className={`hover:bg-gray-50 ${selectedPurchaseIds.has(p.id) ? 'bg-blue-50' : ''}`}>
                    <td className="px-3 py-2">
                      <input type="checkbox" className="w-4 h-4 rounded cursor-pointer accent-blue-600"
                        checked={selectedPurchaseIds.has(p.id)}
                        onChange={e => setSelectedPurchaseIds(prev => {
                          const s = new Set(prev); e.target.checked ? s.add(p.id) : s.delete(p.id); return s
                        })}
                      />
                    </td>
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
                {!filteredPurchases.length && (
                  <tr><td colSpan={COLS_PURCHASE.filter(c => visPurchase.has(c.key)).length + 1} className="text-center py-10 text-gray-400">
                    {searchPurchase ? 'Không tìm thấy kết quả' : 'Chưa có phiếu nhập'}
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Tab: Phiếu xuất ── */}
      {tab === 'export' && (
        <div className="card p-0 overflow-hidden">
          <div className="px-5 py-3 border-b flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-gray-600 whitespace-nowrap">Phiếu xuất hàng</span>
              {/* Lọc nhanh theo trạng thái xuất kho */}
              <div className="flex gap-1">
                {([['', 'Tất cả'], ['PENDING', 'Chưa xuất'], ['EXPORTING', 'Đang xuất'], ['EXPORTED', 'Đã xuất']] as [string,string][]).map(([val, label]) => (
                  <button key={val} onClick={() => { setFilterWhStatus(val); setSelectedExportIds(new Set()) }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${filterWhStatus === val ? 'bg-blue-600 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-600'}`}>
                    {label}
                    {val && (
                      <span className="ml-1 font-bold">
                        {(exportOrders?.data || []).filter((o: any) => o.status !== 'CANCELLED' && o.status !== 'REFUNDED' && (o.warehouseStatus || 'PENDING') === val).length}
                      </span>
                    )}
                  </button>
                ))}
              </div>
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input className="input pl-8 py-1.5 text-sm w-52"
                  placeholder="Tìm mã đơn, khách hàng..."
                  value={searchExport} onChange={e => { setSearchExport(e.target.value); setSelectedExportIds(new Set()) }} />
              </div>
              {selectedExportIds.size > 0 && (
                <>
                  <span className="text-sm text-blue-600 font-medium whitespace-nowrap">Đã chọn {selectedExportIds.size} đơn</span>
                  <button onClick={() => setSelectedExportIds(new Set())} className="text-xs text-gray-400 hover:text-gray-600 underline">Bỏ chọn</button>
                </>
              )}
            </div>
            <div className="flex gap-2 items-center">
              <ColumnPicker cols={COLS_EXPORT} visible={visExport} onChange={setVisExport} />
              {/* Nút tạo phiếu xuất — chỉ hiện khi có chọn đơn */}
              {selectedExportIds.size > 0 && (
                <div className="flex gap-1.5">
                  <button onClick={() => setExportSlipMode('total')}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700">
                    <Printer size={13} /> Xuất tổng ({selectedExportIds.size})
                  </button>
                  <button onClick={() => setExportSlipMode('detail')}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700">
                    <Printer size={13} /> Xuất chi tiết ({selectedExportIds.size})
                  </button>
                </div>
              )}
              <button onClick={() => {
                const vc = COLS_EXPORT.filter(c => visExport.has(c.key))
                const src = selectedExportIds.size > 0 ? selectedExportOrders : filteredExportOrders
                const rows = src.map((o: any) => vc.map(c => {
                  switch (c.key) {
                    case 'orderCode': return o.orderCode
                    case 'customer': return o.customer?.name || 'Khách lẻ'
                    case 'orderStatus': return o.status === 'COMPLETED' ? 'Hoàn thành' : 'Chờ xử lý'
                    case 'itemCount': return o.items?.length ?? 0
                    case 'total': return o.total
                    case 'paymentMethod': return PAY_LABEL[o.paymentMethod] || o.paymentMethod
                    case 'warehouseStatus': return WH_LABEL[o.warehouseStatus || 'PENDING'] || o.warehouseStatus
                    case 'user': return o.user?.name || ''
                    case 'createdAt': return new Date(o.createdAt).toLocaleDateString('vi-VN')
                    default: return ''
                  }
                }))
                exportExcel(`Phieu-xuat_${from}_${to}`, 'Phieu xuat', vc.map(c => c.label), rows)
              }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-medium hover:bg-green-700">
                <FileSpreadsheet size={13} /> Excel
              </button>
              <button onClick={() => {
                const vc = COLS_EXPORT.filter(c => visExport.has(c.key))
                const src = selectedExportIds.size > 0 ? selectedExportOrders : filteredExportOrders
                const rows = src.map((o: any) => vc.map(c => {
                  switch (c.key) {
                    case 'orderCode': return o.orderCode
                    case 'customer': return o.customer?.name || 'Khách lẻ'
                    case 'orderStatus': return o.status === 'COMPLETED' ? 'Hoàn thành' : 'Chờ xử lý'
                    case 'itemCount': return String(o.items?.length ?? 0)
                    case 'total': return fmt(o.total)
                    case 'paymentMethod': return PAY_LABEL[o.paymentMethod] || o.paymentMethod
                    case 'warehouseStatus': return WH_LABEL[o.warehouseStatus || 'PENDING'] || o.warehouseStatus
                    case 'user': return o.user?.name || ''
                    case 'createdAt': return new Date(o.createdAt).toLocaleString('vi-VN')
                    default: return ''
                  }
                }))
                exportPDF(`Phieu-xuat_${from}_${to}`, 'Danh sach phieu xuat hang', fmtPeriod(from, to), vc.map(c => c.label), rows)
              }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-medium hover:bg-red-700">
                <FileText size={13} /> PDF
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-3 py-3 w-10">
                    <input type="checkbox" className="w-4 h-4 rounded cursor-pointer accent-blue-600"
                      checked={filteredExportOrders.length > 0 && filteredExportOrders.every((o: any) => selectedExportIds.has(o.id))}
                      onChange={e => {
                        const ids = filteredExportOrders.map((o: any) => o.id)
                        if (e.target.checked) setSelectedExportIds(prev => new Set([...prev, ...ids]))
                        else setSelectedExportIds(prev => { const s = new Set(prev); ids.forEach((id: string) => s.delete(id)); return s })
                      }}
                    />
                  </th>
                  {COLS_EXPORT.filter(c => visExport.has(c.key)).map(c => (
                    <th key={c.key} className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">{c.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredExportOrders.map((o: any) => (
                  <tr key={o.id} className={`hover:bg-gray-50 ${selectedExportIds.has(o.id) ? 'bg-blue-50' : ''}`}>
                    <td className="px-3 py-2">
                      <input type="checkbox" className="w-4 h-4 rounded cursor-pointer accent-blue-600"
                        checked={selectedExportIds.has(o.id)}
                        onChange={e => setSelectedExportIds(prev => {
                          const s = new Set(prev); e.target.checked ? s.add(o.id) : s.delete(o.id); return s
                        })}
                      />
                    </td>
                    {visExport.has('orderCode') && <td className="px-4 py-3 font-mono text-xs font-semibold text-blue-700">{o.orderCode}</td>}
                    {visExport.has('customer') && (
                      <td className="px-4 py-3">
                        <p className="font-medium">{o.customer?.name || 'Khách lẻ'}</p>
                        {o.customer?.phone && <p className="text-xs text-gray-400">{o.customer.phone}</p>}
                      </td>
                    )}
                    {visExport.has('orderStatus') && (
                      <td className="px-4 py-3">
                        <span className={`badge ${o.status === 'COMPLETED' ? 'badge-green' : 'badge-yellow'}`}>
                          {o.status === 'COMPLETED' ? 'Hoàn thành' : 'Chờ xử lý'}
                        </span>
                      </td>
                    )}
                    {visExport.has('itemCount') && (
                      <td className="px-4 py-3 text-gray-500">
                        <span className="badge badge-blue">{o.items?.length ?? 0} SP</span>
                      </td>
                    )}
                    {visExport.has('total') && <td className="px-4 py-3 font-semibold text-blue-600 whitespace-nowrap">{fmt(o.total)}</td>}
                    {visExport.has('paymentMethod') && (
                      <td className="px-4 py-3"><span className="badge badge-green">{PAY_LABEL[o.paymentMethod]}</span></td>
                    )}
                    {visExport.has('warehouseStatus') && (
                      <td className="px-4 py-2">
                        <select
                          value={o.warehouseStatus || 'PENDING'}
                          disabled={updateWhStatus.isPending}
                          onChange={e => updateWhStatus.mutate({ id: o.id, warehouseStatus: e.target.value })}
                          className={`text-xs font-semibold rounded-lg px-2 py-1.5 border-0 cursor-pointer outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-50
                            ${(o.warehouseStatus || 'PENDING') === 'EXPORTED'  ? 'bg-green-100 text-green-700' :
                              (o.warehouseStatus || 'PENDING') === 'EXPORTING' ? 'bg-blue-100 text-blue-700' :
                                                                                  'bg-yellow-100 text-yellow-700'}`}>
                          <option value="PENDING">Chưa xuất</option>
                          <option value="EXPORTING">Đang xuất</option>
                          <option value="EXPORTED">Đã xuất</option>
                        </select>
                      </td>
                    )}
                    {visExport.has('user') && <td className="px-4 py-3 text-gray-500">{o.user?.name}</td>}
                    {visExport.has('createdAt') && <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">{new Date(o.createdAt).toLocaleString('vi-VN')}</td>}
                  </tr>
                ))}
                {!filteredExportOrders.length && (
                  <tr><td colSpan={COLS_EXPORT.filter(c => visExport.has(c.key)).length + 1} className="text-center py-10 text-gray-400">
                    {searchExport ? 'Không tìm thấy kết quả' : 'Chưa có đơn hàng nào trong khoảng thời gian này'}
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
          {filteredExportOrders.length > 0 && (
            <div className="px-5 py-3 border-t text-sm text-gray-500 flex items-center justify-between">
              <span>Tổng: <strong>{filteredExportOrders.length}</strong> đơn xuất · Giá trị: <strong className="text-blue-600">{fmt(filteredExportOrders.reduce((s: number, o: any) => s + o.total, 0))}</strong></span>
              {selectedExportIds.size === 0 && (
                <p className="text-xs text-gray-400 italic">Chọn các đơn để tạo phiếu xuất</p>
              )}
            </div>
          )}
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

      {/* ==================== Modal Phiếu xuất ==================== */}
      {exportSlipMode && selectedExportOrders.length > 0 && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-3xl max-h-[92vh] flex flex-col">
            {/* Toolbar */}
            <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0">
              <div>
                <h2 className="font-bold text-gray-800 text-lg">
                  {exportSlipMode === 'total' ? 'Phiếu xuất tổng hợp' : 'Phiếu xuất chi tiết'}
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  {selectedExportOrders.length} đơn hàng · {fmtPeriod(from, to)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex gap-1.5">
                  <button onClick={() => setExportSlipMode('total')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${exportSlipMode === 'total' ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 hover:bg-gray-50'}`}>
                    Xuất tổng
                  </button>
                  <button onClick={() => setExportSlipMode('detail')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${exportSlipMode === 'detail' ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-300 hover:bg-gray-50'}`}>
                    Xuất chi tiết
                  </button>
                </div>
                <button onClick={() => {
                  const content = exportSlipRef.current?.innerHTML
                  if (!content) return
                  const title = exportSlipMode === 'total' ? 'PHIẾU XUẤT TỔNG HỢP' : 'PHIẾU XUẤT CHI TIẾT'
                  const win = window.open('', '_blank', 'width=900,height=1000')
                  if (!win) return
                  win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/>
                    <title>${title}</title>
                    <style>
                      *{margin:0;padding:0;box-sizing:border-box}
                      body{font-family:Arial,sans-serif;font-size:13px;color:#111;padding:20px}
                      h1{font-size:20px;font-weight:bold;text-align:center;letter-spacing:1px}
                      h2{font-size:13px;font-weight:normal;color:#555;text-align:center;margin-top:3px}
                      .divider{border-bottom:2px solid #111;margin:10px 0 14px}
                      .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:12px;font-size:12px}
                      .info-row{display:flex;gap:6px}.label{color:#666}.value{font-weight:600}
                      table{width:100%;border-collapse:collapse;margin-bottom:14px}
                      th{background:#f3f4f6;padding:7px 8px;text-align:left;font-weight:600;border:1px solid #d1d5db;font-size:11px}
                      td{padding:6px 8px;border:1px solid #e5e7eb;font-size:11px}
                      tr:nth-child(even) td{background:#f9fafb}
                      .right{text-align:right}.center{text-align:center}
                      .total-box{margin-left:auto;width:260px;font-size:12px}
                      .total-row{display:flex;justify-content:space-between;padding:3px 0}
                      .grand{border-top:2px solid #111;padding-top:6px;margin-top:3px;font-size:14px;font-weight:bold}
                      .order-section{border:1px solid #ddd;border-radius:6px;padding:12px;margin-bottom:16px;page-break-inside:avoid}
                      .order-header{background:#f8faff;padding:8px 10px;border-radius:4px;margin-bottom:8px;font-size:12px}
                      .sigs{display:grid;grid-template-columns:1fr 1fr;gap:32px;margin-top:36px}
                      .sig{text-align:center}.sig-title{font-weight:600;font-size:12px}
                      .sig-note{font-size:10px;color:#888}.sig-line{border-top:1px dashed #aaa;margin-top:44px;padding-top:3px;font-size:11px;color:#666}
                      .badge{display:inline-block;padding:2px 7px;border-radius:9999px;font-size:10px;font-weight:600}
                      .badge-green{background:#dcfce7;color:#166534}.badge-blue{background:#dbeafe;color:#1e40af}
                      @media print{body{padding:10px}.order-section{page-break-inside:avoid}}
                    </style></head><body>${content}</body></html>`)
                  win.document.close()
                  win.focus()
                  setTimeout(() => win.print(), 300)
                  const toExport = selectedExportOrders.filter((o: any) => (o.warehouseStatus || 'PENDING') !== 'EXPORTED')
                  if (toExport.length > 0) {
                    Promise.all(
                      toExport.map((o: any) => api.patch(`/orders/${o.id}/warehouse-status`, { warehouseStatus: 'EXPORTED' }))
                    ).then(() => {
                      toast.success(`Đã xuất kho ${toExport.length} đơn hàng`)
                      qc.invalidateQueries({ queryKey: ['export-orders'] })
                    }).catch(() => toast.error('Lỗi cập nhật trạng thái xuất kho'))
                  }
                }} className="btn-primary flex items-center gap-2 py-2">
                  <Printer size={15} /> In phiếu
                </button>
                <button onClick={() => setExportSlipMode(null)} className="text-gray-400 hover:text-gray-600 ml-1"><X size={20} /></button>
              </div>
            </div>

            {/* Preview */}
            <div className="overflow-y-auto p-6">
              <div ref={exportSlipRef} className="font-sans text-sm text-gray-900">

                {/* ── Xuất tổng ── */}
                {exportSlipMode === 'total' && (
                  <>
                    <h1 className="text-xl font-bold text-center tracking-wide">PHIẾU XUẤT TỔNG HỢP</h1>
                    <h2 className="text-sm text-gray-500 text-center mt-1">Hesta Distribution</h2>
                    <div className="divider border-b-2 border-gray-900 my-3" />
                    <div className="info-grid grid grid-cols-2 gap-2 mb-4 text-sm">
                      <div className="info-row flex gap-2"><span className="label text-gray-500">Ngày xuất:</span><span className="value font-semibold">{new Date().toLocaleString('vi-VN')}</span></div>
                      <div className="info-row flex gap-2"><span className="label text-gray-500">Số đơn hàng:</span><span className="value font-semibold">{selectedExportOrders.length} đơn</span></div>
                      <div className="info-row flex gap-2 col-span-2"><span className="label text-gray-500">Mã đơn:</span>
                        <span className="value font-mono text-xs">{selectedExportOrders.map((o: any) => o.orderCode).join(', ')}</span>
                      </div>
                    </div>

                    <table className="w-full border-collapse mb-4 text-xs">
                      <thead>
                        <tr className="bg-gray-100">
                          {['STT', 'Mã SP', 'Tên sản phẩm', 'ĐVT', 'SL tổng'].map((h, i) => (
                            <th key={h} className={`border border-gray-300 px-2 py-2 font-semibold ${i >= 3 ? 'text-center' : 'text-left'}`}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {mergedItemsForTotal.map(({ product, qty }, idx) => (
                          <tr key={idx} className={idx % 2 === 1 ? 'bg-gray-50' : ''}>
                            <td className="border border-gray-200 px-2 py-1.5 text-center">{idx + 1}</td>
                            <td className="border border-gray-200 px-2 py-1.5 font-mono text-xs">{product?.code}</td>
                            <td className="border border-gray-200 px-2 py-1.5">{product?.name}</td>
                            <td className="border border-gray-200 px-2 py-1.5 text-center">{product?.unit || 'cái'}</td>
                            <td className="border border-gray-200 px-2 py-1.5 text-center font-bold text-blue-700">{qty}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    <div className="total-box ml-auto w-64 text-sm space-y-1 mb-6">
                      <div className="total-row flex justify-between">
                        <span className="text-gray-500">Tổng loại sản phẩm:</span>
                        <span className="font-semibold">{mergedItemsForTotal.length} loại</span>
                      </div>
                      <div className="total-row grand flex justify-between border-t-2 border-gray-900 pt-2 font-bold text-base">
                        <span>Tổng số lượng:</span>
                        <span className="text-blue-700">{mergedItemsForTotal.reduce((s, i) => s + i.qty, 0)}</span>
                      </div>
                      <div className="total-row flex justify-between border-t mt-1 pt-1">
                        <span className="text-gray-500">Tổng giá trị:</span>
                        <span className="font-bold text-blue-600">{fmt(selectedExportOrders.reduce((s: number, o: any) => s + o.total, 0))}</span>
                      </div>
                    </div>

                    <div className="sigs grid grid-cols-2 gap-8 mt-10">
                      <div className="sig text-center">
                        <p className="sig-title font-semibold text-sm">Người lập phiếu</p>
                        <p className="sig-note text-xs text-gray-400">(Ký, ghi rõ họ tên)</p>
                        <div className="sig-line border-t border-dashed border-gray-400 mt-12 pt-1 text-xs text-gray-500">
                          {selectedExportOrders[0]?.user?.name}
                        </div>
                      </div>
                      <div className="sig text-center">
                        <p className="sig-title font-semibold text-sm">Thủ kho</p>
                        <p className="sig-note text-xs text-gray-400">(Ký, ghi rõ họ tên)</p>
                        <div className="sig-line border-t border-dashed border-gray-400 mt-12 pt-1 text-xs text-gray-500" />
                      </div>
                    </div>
                  </>
                )}

                {/* ── Xuất chi tiết ── */}
                {exportSlipMode === 'detail' && (
                  <>
                    <h1 className="text-xl font-bold text-center tracking-wide">PHIẾU XUẤT CHI TIẾT</h1>
                    <h2 className="text-sm text-gray-500 text-center mt-1">Hesta Distribution</h2>
                    <div className="divider border-b-2 border-gray-900 my-3" />

                    {selectedExportOrders.map((o: any, oidx: number) => (
                      <div key={o.id} className="order-section border border-gray-200 rounded-xl p-4 mb-5">
                        <div className="order-header bg-blue-50 rounded-lg px-3 py-2 mb-3 flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-4 text-sm flex-wrap">
                            <span className="font-mono font-bold text-blue-700">{o.orderCode}</span>
                            <span className="text-gray-500">Khách: <strong>{o.customer?.name || 'Khách lẻ'}</strong>{o.customer?.phone ? ` (${o.customer.phone})` : ''}</span>
                            <span className="text-gray-500">NV: <strong>{o.user?.name}</strong></span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-gray-400">
                            <span>{new Date(o.createdAt).toLocaleString('vi-VN')}</span>
                            <span className="badge badge-green">Hoàn thành</span>
                          </div>
                        </div>

                        <table className="w-full border-collapse text-xs mb-3">
                          <thead>
                            <tr className="bg-gray-100">
                              {['STT', 'Mã SP', 'Tên sản phẩm', 'ĐVT', 'SL', 'Đơn giá', 'Thành tiền'].map((h, i) => (
                                <th key={h} className={`border border-gray-300 px-2 py-1.5 font-semibold ${i >= 4 ? 'text-right' : i === 3 ? 'text-center' : 'text-left'}`}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {o.items?.map((item: any, idx: number) => (
                              <tr key={item.id} className={idx % 2 === 1 ? 'bg-gray-50' : ''}>
                                <td className="border border-gray-200 px-2 py-1.5 text-center">{idx + 1}</td>
                                <td className="border border-gray-200 px-2 py-1.5 font-mono text-xs">{item.product?.code}</td>
                                <td className="border border-gray-200 px-2 py-1.5">{item.product?.name}</td>
                                <td className="border border-gray-200 px-2 py-1.5 text-center">{item.unit || item.product?.unit || 'cái'}</td>
                                <td className="border border-gray-200 px-2 py-1.5 text-right font-medium">{item.qty}</td>
                                <td className="border border-gray-200 px-2 py-1.5 text-right">{fmt(item.price)}</td>
                                <td className="border border-gray-200 px-2 py-1.5 text-right font-semibold text-blue-600">{fmt(item.total)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>

                        <div className="total-box ml-auto w-56 text-xs space-y-1">
                          {o.discount > 0 && (
                            <div className="total-row flex justify-between text-red-500">
                              <span>Giảm giá:</span><span>- {fmt(o.discount)}</span>
                            </div>
                          )}
                          <div className="grand flex justify-between border-t border-gray-300 pt-1 font-bold text-sm">
                            <span>Tổng cộng:</span>
                            <span className="text-blue-600">{fmt(o.total)}</span>
                          </div>
                          <div className="total-row flex justify-between text-gray-500">
                            <span>Thanh toán:</span><span>{PAY_LABEL[o.paymentMethod]}</span>
                          </div>
                        </div>

                        {oidx < selectedExportOrders.length - 1 && (
                          <div className="sigs grid grid-cols-2 gap-8 mt-8">
                            <div className="sig text-center text-xs">
                              <p className="font-semibold">Người lập phiếu</p>
                              <p className="text-gray-400">(Ký, ghi rõ họ tên)</p>
                              <div className="border-t border-dashed border-gray-400 mt-10 pt-1 text-gray-500">{o.user?.name}</div>
                            </div>
                            <div className="sig text-center text-xs">
                              <p className="font-semibold">Người nhận hàng</p>
                              <p className="text-gray-400">(Ký, ghi rõ họ tên)</p>
                              <div className="border-t border-dashed border-gray-400 mt-10 pt-1 text-gray-500">{o.customer?.name || 'Khách lẻ'}</div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}

                    {/* Tổng kết cuối */}
                    <div className="bg-blue-50 rounded-xl p-4 text-sm">
                      <div className="flex justify-between font-bold text-base">
                        <span>Tổng giá trị xuất ({selectedExportOrders.length} đơn):</span>
                        <span className="text-blue-600">{fmt(selectedExportOrders.reduce((s: number, o: any) => s + o.total, 0))}</span>
                      </div>
                    </div>

                    <div className="sigs grid grid-cols-2 gap-8 mt-10">
                      <div className="sig text-center">
                        <p className="sig-title font-semibold text-sm">Người lập phiếu</p>
                        <p className="sig-note text-xs text-gray-400">(Ký, ghi rõ họ tên)</p>
                        <div className="sig-line border-t border-dashed border-gray-400 mt-12 pt-1 text-xs text-gray-500">
                          {selectedExportOrders[0]?.user?.name}
                        </div>
                      </div>
                      <div className="sig text-center">
                        <p className="sig-title font-semibold text-sm">Thủ kho xác nhận</p>
                        <p className="sig-note text-xs text-gray-400">(Ký, ghi rõ họ tên)</p>
                        <div className="sig-line border-t border-dashed border-gray-400 mt-12 pt-1 text-xs text-gray-500" />
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

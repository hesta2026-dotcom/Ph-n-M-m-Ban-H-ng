import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../../services/api'
import toast from 'react-hot-toast'
import { CheckCircle, TrendingDown, TrendingUp, X, FileSpreadsheet, FileText, Search, Pencil } from 'lucide-react'
import { exportExcel, exportPDF, PRESETS, fmtPeriod } from '../../utils/export'
import ColumnPicker, { ColDef } from '../../components/ColumnPicker'

const fmt = (n: number) => new Intl.NumberFormat('vi-VN').format(n) + 'đ'
const fmtMoney = (n: number) => n === 0 ? '' : n.toLocaleString('vi-VN')
const parseMoney = (s: string) => +s.replace(/[^0-9]/g, '') || 0
const PAY_LABEL: any = { CASH: 'Tiền mặt', CARD: 'Thẻ ngân hàng', TRANSFER: 'Chuyển khoản', DEBT: 'Ghi nợ', MIXED: 'Hỗn hợp' }
const ORDER_STATUS: any = { PENDING: 'Chờ xử lý', COMPLETED: 'Hoàn thành', CANCELLED: 'Đã hủy', REFUNDED: 'Hoàn hàng' }
const ORDER_STATUS_CLASS: any = { PENDING: 'badge-yellow', COMPLETED: 'badge-green', CANCELLED: 'badge-red', REFUNDED: 'badge-blue' }

const COLS: ColDef[] = [
  { key: 'party', label: 'Đối tác' },
  { key: 'note', label: 'Diễn giải' },
  { key: 'amount', label: 'Tổng tiền' },
  { key: 'payInput', label: 'Nhập số tiền' },
  { key: 'remaining', label: 'Còn lại' },
  { key: 'status', label: 'Trạng thái' },
  { key: 'createdAt', label: 'Ngày tạo' },
]

export default function Debts() {
  const [type, setType] = useState('SUPPLIER')
  const [status, setStatus] = useState('')
  const now = new Date()
  const _ld = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const [from, setFrom] = useState(_ld(new Date(now.getFullYear(), now.getMonth(), 1)))
  const [to, setTo] = useState(_ld(now))
  const [activePreset, setActivePreset] = useState('Tháng này')
  const [payAmount, setPayAmount] = useState<{ [id: string]: number }>({})
  const [viewDebt, setViewDebt] = useState<any>(null)
  const [visible, setVisible] = useState<Set<string>>(() => new Set(COLS.map(c => c.key)))
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const [editMode, setEditMode] = useState(false)
  const [editItems, setEditItems] = useState<{ productId: string; productName: string; qty: number; costPrice: number }[]>([])
  const [editNote, setEditNote] = useState('')
  const [editPaid, setEditPaid] = useState(0)
  const [editItemSearch, setEditItemSearch] = useState<string[]>([])
  const [editDropdown, setEditDropdown] = useState<number | null>(null)
  const qc = useQueryClient()

  const applyPreset = (p: typeof PRESETS[number]) => {
    const [f, t] = p.getDates(); setFrom(f); setTo(t); setActivePreset(p.label)
  }

  const applyDateFilter = status === 'PAID'
  const { data } = useQuery({
    queryKey: ['debts', type, status, applyDateFilter ? from : null, applyDateFilter ? to : null],
    queryFn: () => {
      const dateParams = applyDateFilter ? `&from=${from}&to=${to}` : ''
      return api.get(`/debts?type=${type}&status=${status}${dateParams}&limit=500`).then(r => r.data)
    }
  })

  const { data: summary } = useQuery({
    queryKey: ['debts-summary'],
    queryFn: async () => {
      const [supUnpaid, supPartial, cusUnpaid, cusPartial] = await Promise.all([
        api.get('/debts?type=SUPPLIER&status=UNPAID&limit=1000').then(r => r.data),
        api.get('/debts?type=SUPPLIER&status=PARTIAL&limit=1000').then(r => r.data),
        api.get('/debts?type=CUSTOMER&status=UNPAID&limit=1000').then(r => r.data),
        api.get('/debts?type=CUSTOMER&status=PARTIAL&limit=1000').then(r => r.data),
      ])
      const supAll = [...(supUnpaid.data ?? []), ...(supPartial.data ?? [])]
      const cusAll = [...(cusUnpaid.data ?? []), ...(cusPartial.data ?? [])]
      return {
        supplierDebt: supAll.reduce((s: number, d: any) => s + d.remaining, 0),
        supplierCount: supAll.length,
        customerDebt: cusAll.reduce((s: number, d: any) => s + d.remaining, 0),
        customerCount: cusAll.length,
      }
    }
  })

  const { data: orderDetail, isLoading: loadingOrder } = useQuery({
    queryKey: ['debt-order', viewDebt?.orderId],
    queryFn: () => api.get(`/orders/${viewDebt.orderId}`).then(r => r.data),
    enabled: !!viewDebt?.orderId
  })

  const { data: purchaseDetail, isLoading: loadingPurchase } = useQuery({
    queryKey: ['debt-purchase', viewDebt?.id],
    queryFn: async () => {
      const code = viewDebt?.note?.replace('Phiếu nhập ', '')
      if (!code) return null
      const res = await api.get(`/purchases?limit=100`)
      return res.data.data?.find((p: any) => p.code === code) || null
    },
    enabled: !!viewDebt && viewDebt.type === 'SUPPLIER' && !viewDebt.orderId
  })

  const { data: products } = useQuery({
    queryKey: ['products-all'],
    queryFn: () => api.get('/products?limit=1000').then(r => r.data.data),
  })

  const pay = useMutation({
    mutationFn: ({ id, amount }: { id: string; amount: number }) => api.post(`/debts/${id}/pay`, { amount }),
    onSuccess: () => {
      toast.success('Đã thanh toán')
      qc.invalidateQueries({ queryKey: ['debts'] })
      qc.invalidateQueries({ queryKey: ['debts-summary'] })
      qc.invalidateQueries({ queryKey: ['suppliers'] })
      setPayAmount({})
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Lỗi')
  })

  const payBulk = useMutation({
    mutationFn: async (ids: string[]) => {
      const results = await Promise.allSettled(
        ids.map(id => api.post(`/debts/${id}/pay`, { amount: payAmount[id] || 0 }))
      )
      const failed = results.filter(r => r.status === 'rejected').length
      return { total: ids.length, failed }
    },
    onSuccess: ({ total, failed }) => {
      if (failed === 0) toast.success(`Đã thanh toán ${total} khoản`)
      else toast.error(`${total - failed}/${total} khoản thành công, ${failed} khoản lỗi`)
      qc.invalidateQueries({ queryKey: ['debts'] })
      qc.invalidateQueries({ queryKey: ['debts-summary'] })
      setSelectedIds(new Set())
      setPayAmount({})
    },
    onError: () => toast.error('Lỗi thanh toán hàng loạt')
  })

  const updatePurchase = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      api.put(`/purchases/${id}`, data).then(r => r.data),
    onSuccess: () => {
      toast.success('Đã cập nhật phiếu nhập')
      setEditMode(false)
      qc.invalidateQueries({ queryKey: ['debts'] })
      qc.invalidateQueries({ queryKey: ['debts-summary'] })
      qc.invalidateQueries({ queryKey: ['debt-purchase', viewDebt?.id] })
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Lỗi cập nhật')
  })

  const switchType = (newType: string) => { setType(newType); setStatus(''); setSelectedIds(new Set()) }

  const statusLabel = (d: any) => {
    if (d.status === 'PAID') return d.type === 'SUPPLIER' ? 'Đã trả' : 'Đã thu'
    if (d.status === 'PARTIAL') return 'Trả 1 phần'
    return d.type === 'SUPPLIER' ? 'Phải trả' : 'Phải thu'
  }
  const statusClass: any = { UNPAID: 'badge-red', PARTIAL: 'badge-yellow', PAID: 'badge-green' }
  const unpaidLabel = type === 'SUPPLIER' ? 'Phải trả' : 'Phải thu'
  const payBtnLabel = type === 'SUPPLIER' ? 'Thanh toán NCC' : 'Thu tiền khách hàng'

  const exportCols = COLS.filter(c => visible.has(c.key) && c.key !== 'payInput')
  const visCols = COLS.filter(c => visible.has(c.key))

  const getExportVal = (d: any, key: string) => {
    switch (key) {
      case 'party': return d.customer?.name || d.supplier?.name || '-'
      case 'note': return d.note || '-'
      case 'amount': return d.amount
      case 'remaining': return d.remaining
      case 'status': return statusLabel(d)
      case 'createdAt': return new Date(d.createdAt).toLocaleDateString('vi-VN')
      default: return ''
    }
  }

  const handleExcel = () => {
    const headers = exportCols.map(c =>
      c.key === 'party' ? (type === 'CUSTOMER' ? 'Khách hàng' : 'Nhà cung cấp') : c.label
    )
    const rows = (data?.data || []).map((d: any) => exportCols.map(c => getExportVal(d, c.key)))
    exportExcel(`Cong-no_${from}_${to}`, 'Cong no', headers, rows)
  }

  const handlePDF = () => {
    const headers = exportCols.map(c =>
      c.key === 'party' ? (type === 'CUSTOMER' ? 'Khách hàng' : 'Nhà cung cấp') : c.label
    )
    const rows = (data?.data || []).map((d: any) => exportCols.map(c => {
      if (c.key === 'amount' || c.key === 'remaining') return fmt(d[c.key])
      return getExportVal(d, c.key)
    }))
    const title = type === 'CUSTOMER' ? 'Phải thu khách hàng' : 'Nợ nhà cung cấp'
    exportPDF(`Cong-no_${from}_${to}`, title, fmtPeriod(from, to), headers, rows)
  }

  const detail = viewDebt?.type === 'CUSTOMER' ? orderDetail : purchaseDetail
  const loadingDetail = loadingOrder || loadingPurchase

  const filteredData = (data?.data || []).filter((d: any) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (d.customer?.name || '').toLowerCase().includes(q) ||
      (d.supplier?.name || '').toLowerCase().includes(q) ||
      (d.note || '').toLowerCase().includes(q)
  })

  const selectedDebts = filteredData.filter((d: any) => selectedIds.has(d.id))
  const selectedAmountTotal = selectedDebts.reduce((s: number, d: any) => s + d.amount, 0)
  const selectedRemainingTotal = selectedDebts.reduce((s: number, d: any) => s + d.remaining, 0)
  const selectedPayTotal = selectedDebts.reduce((s: number, d: any) => s + (payAmount[d.id] || 0), 0)

  const toggleSelect = (id: string, debt?: any) => {
    setSelectedIds(prev => {
      const s = new Set(prev)
      if (s.has(id)) {
        s.delete(id)
      } else {
        s.add(id)
        if (debt && debt.remaining > 0) {
          setPayAmount(p => ({ ...p, [id]: debt.remaining }))
        }
      }
      return s
    })
  }

  const toggleAll = (checked: boolean) => {
    setSelectedIds(checked ? new Set(filteredData.map((d: any) => d.id)) : new Set())
    if (checked) {
      const amounts: { [id: string]: number } = {}
      filteredData.forEach((d: any) => { if (d.remaining > 0) amounts[d.id] = d.remaining })
      setPayAmount(p => ({ ...p, ...amounts }))
    }
  }

  const startEdit = () => {
    if (!detail) return
    setEditItems(detail.items.map((item: any) => ({
      productId: item.productId,
      productName: item.product?.name || '',
      qty: item.qty,
      costPrice: item.costPrice,
    })))
    setEditNote(detail.note || '')
    setEditPaid(detail.paid || 0)
    setEditItemSearch(detail.items.map(() => ''))
    setEditMode(true)
  }

  const addEditItem = () => {
    setEditItems(s => [...s, { productId: '', productName: '', qty: 1, costPrice: 0 }])
    setEditItemSearch(s => [...s, ''])
  }

  const removeEditItem = (idx: number) => {
    setEditItems(s => s.filter((_, i) => i !== idx))
    setEditItemSearch(s => s.filter((_, i) => i !== idx))
  }

  const updateEditItem = (idx: number, field: 'qty' | 'costPrice', val: number) => {
    setEditItems(s => s.map((item, i) => i === idx ? { ...item, [field]: val } : item))
  }

  const selectEditProduct = (idx: number, product: any) => {
    setEditItems(s => s.map((item, i) => i === idx
      ? { ...item, productId: product.id, productName: product.name, costPrice: product.costPrice || item.costPrice }
      : item
    ))
    setEditItemSearch(s => { const n = [...s]; n[idx] = ''; return n })
    setEditDropdown(null)
  }

  const handleSaveEdit = () => {
    if (!detail) return
    if (editItems.length === 0) return toast.error('Phiếu nhập phải có ít nhất 1 sản phẩm')
    if (editItems.some(i => !i.productId)) return toast.error('Vui lòng chọn sản phẩm đầy đủ')
    updatePurchase.mutate({
      id: detail.id,
      data: {
        items: editItems.map(i => ({ productId: i.productId, qty: i.qty, costPrice: i.costPrice })),
        note: editNote,
        paid: editPaid,
      }
    })
  }

  const editTotal = editItems.reduce((s, i) => s + i.qty * i.costPrice, 0)

  const closeModal = () => { setViewDebt(null); setEditMode(false) }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Công nợ</h1>

      {applyDateFilter ? (
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
      ) : (
        <div className="card py-2.5 px-4 bg-blue-50 border border-blue-100">
          <p className="text-sm text-blue-700">Hiển thị toàn bộ công nợ chưa thanh toán — bộ lọc ngày chỉ áp dụng khi xem công nợ <strong>Đã thu/Đã trả</strong>.</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="card p-4 flex items-center gap-3 cursor-pointer hover:bg-red-50/30 transition-colors" onClick={() => switchType('SUPPLIER')}>
          <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <TrendingDown size={20} className="text-red-600" />
          </div>
          <div>
            <p className="text-xs text-gray-500">Phải trả NCC</p>
            <p className="text-lg font-bold text-red-600">{fmt(summary?.supplierDebt ?? 0)}</p>
            <p className="text-xs text-gray-400">{summary?.supplierCount ?? 0} phiếu chưa thanh toán</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3 cursor-pointer hover:bg-blue-50/30 transition-colors" onClick={() => switchType('CUSTOMER')}>
          <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <TrendingUp size={20} className="text-blue-600" />
          </div>
          <div>
            <p className="text-xs text-gray-500">Phải thu khách hàng</p>
            <p className="text-lg font-bold text-blue-600">{fmt(summary?.customerDebt ?? 0)}</p>
            <p className="text-xs text-gray-400">{summary?.customerCount ?? 0} khoản chưa thu</p>
          </div>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap items-center">
        {[['SUPPLIER', 'Nợ nhà cung cấp'], ['CUSTOMER', 'Phải thu khách hàng']].map(([val, label]) => (
          <button key={val} onClick={() => switchType(val)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${type === val ? 'bg-blue-600 text-white' : 'bg-white border hover:bg-gray-50'}`}>
            {label}
          </button>
        ))}
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pl-8 py-1.5 text-sm w-48"
            placeholder={type === 'CUSTOMER' ? 'Tìm khách hàng...' : 'Tìm nhà cung cấp...'}
            value={search} onChange={e => { setSearch(e.target.value); setSelectedIds(new Set()) }} />
        </div>
        <div className="flex gap-2 ml-auto items-center">
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-blue-600 whitespace-nowrap">✓ {selectedIds.size} dòng</span>
              <button onClick={() => setSelectedIds(new Set())} className="text-xs text-gray-400 hover:text-gray-600 underline whitespace-nowrap">Bỏ chọn</button>
            </div>
          )}
          <ColumnPicker cols={COLS} visible={visible} onChange={setVisible} />
          <button onClick={handleExcel} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700">
            <FileSpreadsheet size={14} /> Excel
          </button>
          <button onClick={handlePDF} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700">
            <FileText size={14} /> PDF
          </button>
        </div>
        <div className="flex gap-2">
          {[['UNPAID', unpaidLabel], ['PARTIAL', 'Trả 1 phần'], ['PAID', type === 'SUPPLIER' ? 'Đã trả' : 'Đã thu'], ['', 'Tất cả']].map(([val, label]) => (
            <button key={val} onClick={() => setStatus(val)}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${status === val ? 'bg-gray-800 text-white' : 'bg-white border hover:bg-gray-50'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        {filteredData.length > 0 && selectedIds.size === 0 && (
          <div className="px-4 py-2 border-b bg-gray-50 flex items-center gap-4 text-sm text-gray-500">
            <span><strong>{filteredData.length}</strong> khoản</span>
            <span>Tổng tiền: <strong className="text-blue-600">{fmt(filteredData.reduce((s: number, d: any) => s + d.amount, 0))}</strong></span>
            <span>Còn lại: <strong className="text-red-600">{fmt(filteredData.reduce((s: number, d: any) => s + d.remaining, 0))}</strong></span>
          </div>
        )}
        {selectedIds.size > 0 && (
          <div className="px-4 py-2.5 border-b bg-blue-50 flex items-center gap-6 flex-wrap text-sm">
            <span className="font-semibold text-blue-700">{selectedIds.size} / {filteredData.length} dòng được chọn</span>
            <div className="flex items-center gap-1">
              <span className="text-gray-500">Tổng tiền:</span>
              <strong className="text-blue-700">{fmt(selectedAmountTotal)}</strong>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-gray-500">Còn lại:</span>
              <strong className="text-red-600">{fmt(selectedRemainingTotal)}</strong>
            </div>
            {selectedPayTotal > 0 && (
              <div className="flex items-center gap-1">
                <span className="text-gray-500">Sẽ thanh toán:</span>
                <strong className="text-green-700">{fmt(selectedPayTotal)}</strong>
              </div>
            )}
            {selectedPayTotal > 0 && (
              <button
                onClick={() => payBulk.mutate(Array.from(selectedIds))}
                disabled={payBulk.isPending}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-green-600 text-white text-xs font-semibold hover:bg-green-700 disabled:opacity-50 ml-auto">
                <CheckCircle size={13} /> {payBulk.isPending ? 'Đang xử lý...' : `Xác nhận thanh toán ${fmt(selectedPayTotal)}`}
              </button>
            )}
          </div>
        )}
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-3 py-3 w-10">
                <input type="checkbox" className="w-4 h-4 rounded cursor-pointer accent-blue-600"
                  checked={filteredData.length > 0 && filteredData.every((d: any) => selectedIds.has(d.id))}
                  onChange={e => toggleAll(e.target.checked)} />
              </th>
              {visCols.map(c => {
                let label = c.label
                if (c.key === 'party') label = type === 'CUSTOMER' ? 'Khách hàng' : 'Nhà cung cấp'
                if (c.key === 'payInput') label = type === 'SUPPLIER' ? 'Số tiền đã trả' : 'Số tiền đã thu'
                if (c.key === 'remaining') label = type === 'SUPPLIER' ? 'Còn phải trả' : 'Còn phải thu'
                return <th key={c.key} className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">{label}</th>
              })}
              <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filteredData.map((d: any) => (
              <tr key={d.id} className={`hover:bg-gray-50 ${selectedIds.has(d.id) ? 'bg-blue-50' : d.status === 'UNPAID' ? 'bg-red-50/30' : ''}`}>
                <td className="px-3 py-2">
                  <input type="checkbox" className="w-4 h-4 rounded cursor-pointer accent-blue-600"
                    checked={selectedIds.has(d.id)}
                    onChange={() => toggleSelect(d.id, d)} />
                </td>
                {visible.has('party') && <td className="px-4 py-3 font-medium">{d.customer?.name || d.supplier?.name || '-'}</td>}
                {visible.has('note') && <td className="px-4 py-3 text-gray-400 text-xs max-w-[160px] truncate">{d.note || '-'}</td>}
                {visible.has('amount') && (
                  <td className="px-4 py-3 whitespace-nowrap">
                    <button onClick={() => setViewDebt(d)} className="font-semibold text-blue-600 hover:text-blue-800 hover:underline">
                      {fmt(d.amount)}
                    </button>
                  </td>
                )}
                {visible.has('payInput') && (
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="relative w-32">
                      <input
                        className="border rounded px-2 py-1 w-full text-sm text-right pr-5 focus:outline-none focus:ring-1 focus:ring-blue-400"
                        placeholder="Nhập số tiền..."
                        value={fmtMoney(payAmount[d.id] ?? 0)}
                        onChange={e => setPayAmount(p => ({ ...p, [d.id]: parseMoney(e.target.value) }))}
                      />
                      <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">đ</span>
                    </div>
                  </td>
                )}
                {visible.has('remaining') && (
                  <td className="px-4 py-3 whitespace-nowrap">
                    {d.remaining > 0
                      ? <span className="font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded">{fmt(d.remaining)}</span>
                      : <span className="text-gray-400 text-xs">—</span>}
                  </td>
                )}
                {visible.has('status') && (
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-0.5">
                      <span className={`badge ${statusClass[d.status]}`}>{statusLabel(d)}</span>
                      {d.paid > 0 && <span className="text-xs text-green-600">{fmt(d.paid)}</span>}
                    </div>
                  </td>
                )}
                {visible.has('createdAt') && <td className="px-4 py-3 text-gray-400 whitespace-nowrap text-xs">{new Date(d.createdAt).toLocaleDateString('vi-VN')}</td>}
                <td className="px-4 py-3">
                  <button
                    onClick={() => pay.mutate({ id: d.id, amount: payAmount[d.id] })}
                    disabled={!payAmount[d.id] || pay.isPending}
                    title={payBtnLabel}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-medium hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap">
                    <CheckCircle size={14} /> Xác nhận
                  </button>
                </td>
              </tr>
            ))}
            {!filteredData.length && (
              <tr><td colSpan={visCols.length + 2} className="text-center py-10 text-gray-400">
                {search ? 'Không tìm thấy kết quả' : status === 'UNPAID' ? `Không có khoản ${unpaidLabel.toLowerCase()} nào` : 'Không có dữ liệu'}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {viewDebt && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0">
              <div>
                <h2 className="font-bold text-gray-800">{viewDebt.note || 'Chi tiết'}</h2>
                <p className="text-xs text-gray-400">{viewDebt.customer?.name || viewDebt.supplier?.name}</p>
              </div>
              <div className="flex items-center gap-2">
                {viewDebt.type === 'SUPPLIER' && detail && !editMode && !loadingDetail && (
                  <button onClick={startEdit}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-600 text-blue-600 text-sm hover:bg-blue-50 transition-colors">
                    <Pencil size={14} /> Chỉnh sửa
                  </button>
                )}
                <button onClick={closeModal} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
              </div>
            </div>

            <div className="overflow-y-auto p-6 space-y-4">
              {editMode ? (
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-sm text-gray-700">Danh sách sản phẩm</h3>
                      <button onClick={addEditItem} className="text-xs text-blue-600 hover:underline">+ Thêm sản phẩm</button>
                    </div>
                    <div className="space-y-2">
                      {editItems.map((item, idx) => (
                        <div key={idx} className="grid grid-cols-[1fr_70px_110px_90px_28px] gap-2 items-center">
                          <div className="relative">
                            <input
                              className="input text-sm w-full"
                              placeholder="Tìm sản phẩm..."
                              value={editDropdown === idx ? (editItemSearch[idx] ?? '') : item.productName}
                              onChange={e => {
                                setEditItemSearch(s => { const n = [...s]; n[idx] = e.target.value; return n })
                                setEditDropdown(idx)
                              }}
                              onFocus={() => {
                                setEditDropdown(idx)
                                setEditItemSearch(s => { const n = [...s]; n[idx] = ''; return n })
                              }}
                              onBlur={() => setTimeout(() => setEditDropdown(null), 200)}
                            />
                            {editDropdown === idx && (
                              <div className="absolute top-full left-0 z-20 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto w-64 mt-0.5">
                                {(products || []).filter((p: any) => {
                                  const q = (editItemSearch[idx] || '').toLowerCase()
                                  return !q || p.name.toLowerCase().includes(q) || (p.code || '').toLowerCase().includes(q)
                                }).slice(0, 30).map((p: any) => (
                                  <div key={p.id} className="px-3 py-2 hover:bg-blue-50 cursor-pointer text-sm"
                                    onMouseDown={() => selectEditProduct(idx, p)}>
                                    <p className="font-medium">{p.name}</p>
                                    <p className="text-xs text-gray-400">{p.code}</p>
                                  </div>
                                ))}
                                {(products || []).filter((p: any) => {
                                  const q = (editItemSearch[idx] || '').toLowerCase()
                                  return !q || p.name.toLowerCase().includes(q) || (p.code || '').toLowerCase().includes(q)
                                }).length === 0 && (
                                  <p className="px-3 py-2 text-sm text-gray-400">Không tìm thấy</p>
                                )}
                              </div>
                            )}
                          </div>
                          <input type="number" min="1" className="input text-sm text-right"
                            value={item.qty}
                            onChange={e => updateEditItem(idx, 'qty', Math.max(1, +e.target.value))}
                            placeholder="SL" />
                          <input type="number" min="0" className="input text-sm text-right"
                            value={item.costPrice}
                            onChange={e => updateEditItem(idx, 'costPrice', +e.target.value)}
                            placeholder="Giá nhập" />
                          <span className="text-sm font-semibold text-blue-600 text-right whitespace-nowrap">
                            {fmt(item.qty * item.costPrice)}
                          </span>
                          <button onClick={() => removeEditItem(idx)} className="text-red-400 hover:text-red-600 flex items-center justify-center">
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                      {editItems.length === 0 && (
                        <p className="text-sm text-gray-400 text-center py-3">Chưa có sản phẩm nào</p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Ghi chú</label>
                      <input className="input text-sm w-full" value={editNote}
                        onChange={e => setEditNote(e.target.value)} placeholder="Ghi chú phiếu nhập..." />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Đã thanh toán (đ)</label>
                      <input type="number" min="0" className="input text-sm w-full text-right"
                        value={editPaid}
                        onChange={e => setEditPaid(Math.max(0, +e.target.value))} />
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <div className="w-52 space-y-1 text-sm">
                      <div className="flex justify-between font-bold text-base border-t pt-2">
                        <span>Tổng cộng</span>
                        <span className="text-blue-600">{fmt(editTotal)}</span>
                      </div>
                      <div className="flex justify-between text-green-600">
                        <span>Đã trả</span><span>{fmt(editPaid)}</span>
                      </div>
                      <div className="flex justify-between text-red-600">
                        <span>Còn nợ</span><span>{fmt(Math.max(0, editTotal - editPaid))}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t">
                    <button onClick={() => setEditMode(false)}
                      className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">
                      Hủy
                    </button>
                    <button onClick={handleSaveEdit}
                      disabled={updatePurchase.isPending || editItems.length === 0}
                      className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5">
                      {updatePurchase.isPending ? 'Đang lưu...' : 'Lưu thay đổi'}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {loadingDetail && <p className="text-center text-gray-400 py-8">Đang tải...</p>}
                  {!loadingDetail && detail && viewDebt.type === 'CUSTOMER' && (
                    <>
                      <div className="grid grid-cols-2 gap-3 text-sm bg-gray-50 rounded-xl p-4">
                        <div><span className="text-gray-500">Mã đơn: </span><strong className="font-mono">{detail.orderCode}</strong></div>
                        <div><span className="text-gray-500">Ngày: </span><strong>{new Date(detail.createdAt).toLocaleString('vi-VN')}</strong></div>
                        <div><span className="text-gray-500">Khách hàng: </span><strong>{detail.customer?.name || 'Khách lẻ'}</strong></div>
                        <div><span className="text-gray-500">SĐT: </span><strong>{detail.customer?.phone || '—'}</strong></div>
                        <div><span className="text-gray-500">Thanh toán: </span><strong>{PAY_LABEL[detail.paymentMethod]}</strong></div>
                        <div><span className="text-gray-500">Trạng thái: </span>
                          <span className={`badge ${ORDER_STATUS_CLASS[detail.status]}`}>{ORDER_STATUS[detail.status]}</span>
                        </div>
                      </div>
                      <table className="w-full text-sm border rounded-xl overflow-hidden">
                        <thead className="bg-gray-50">
                          <tr>{['Sản phẩm', 'ĐVT', 'SL', 'Đơn giá', 'Thành tiền'].map(h => (
                            <th key={h} className="px-3 py-2 text-left font-medium text-gray-600">{h}</th>
                          ))}</tr>
                        </thead>
                        <tbody className="divide-y">
                          {detail.items?.map((item: any, i: number) => (
                            <tr key={i}>
                              <td className="px-3 py-2"><p>{item.product?.name}</p><p className="text-xs text-gray-400 font-mono">{item.product?.code}</p></td>
                              <td className="px-3 py-2 text-gray-500">{item.unit || item.product?.unit || 'cái'}</td>
                              <td className="px-3 py-2 font-medium">{item.qty}</td>
                              <td className="px-3 py-2">{fmt(item.price)}</td>
                              <td className="px-3 py-2 font-semibold text-blue-600">{fmt(item.total)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <div className="flex justify-end">
                        <div className="w-52 space-y-1 text-sm">
                          <div className="flex justify-between"><span className="text-gray-500">Tạm tính</span><span>{fmt(detail.subtotal)}</span></div>
                          {detail.discount > 0 && <div className="flex justify-between text-red-500"><span>Giảm giá</span><span>-{fmt(detail.discount)}</span></div>}
                          <div className="flex justify-between font-bold text-base border-t pt-2">
                            <span>Tổng cộng</span><span className="text-blue-600">{fmt(detail.total)}</span>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                  {!loadingDetail && detail && viewDebt.type === 'SUPPLIER' && (
                    <>
                      <div className="grid grid-cols-2 gap-3 text-sm bg-gray-50 rounded-xl p-4">
                        <div><span className="text-gray-500">Mã phiếu: </span><strong className="font-mono">{detail.code}</strong></div>
                        <div><span className="text-gray-500">Ngày: </span><strong>{new Date(detail.createdAt).toLocaleString('vi-VN')}</strong></div>
                        <div><span className="text-gray-500">Nhà cung cấp: </span><strong>{detail.supplier?.name}</strong></div>
                        <div><span className="text-gray-500">Ghi chú: </span><strong>{detail.note || '—'}</strong></div>
                      </div>
                      <table className="w-full text-sm border rounded-xl overflow-hidden">
                        <thead className="bg-gray-50">
                          <tr>{['Sản phẩm', 'SL', 'Giá nhập', 'Thành tiền'].map(h => (
                            <th key={h} className="px-3 py-2 text-left font-medium text-gray-600">{h}</th>
                          ))}</tr>
                        </thead>
                        <tbody className="divide-y">
                          {detail.items?.map((item: any, i: number) => (
                            <tr key={i}>
                              <td className="px-3 py-2"><p>{item.product?.name}</p><p className="text-xs text-gray-400 font-mono">{item.product?.code}</p></td>
                              <td className="px-3 py-2 font-medium">{item.qty}</td>
                              <td className="px-3 py-2">{fmt(item.costPrice)}</td>
                              <td className="px-3 py-2 font-semibold text-blue-600">{fmt(item.total)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <div className="flex justify-end">
                        <div className="w-52 space-y-1 text-sm">
                          <div className="flex justify-between font-bold text-base border-t pt-2">
                            <span>Tổng cộng</span><span className="text-blue-600">{fmt(detail.total)}</span>
                          </div>
                          <div className="flex justify-between text-green-600"><span>Đã trả</span><span>{fmt(detail.paid)}</span></div>
                          <div className="flex justify-between text-red-600"><span>Còn nợ</span><span>{fmt(detail.debt)}</span></div>
                        </div>
                      </div>
                    </>
                  )}
                  {!loadingDetail && !detail && (
                    <p className="text-center text-gray-400 py-8">Không tìm thấy thông tin chi tiết</p>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

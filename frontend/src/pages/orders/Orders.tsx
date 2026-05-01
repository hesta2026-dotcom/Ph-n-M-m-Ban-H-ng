import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../../services/api'
import toast from 'react-hot-toast'
import { Eye, Plus, FileText, CheckCircle, XCircle, RotateCcw, Search, FileSpreadsheet } from 'lucide-react'
import CreateOrderModal from './CreateOrderModal'
import ExportSlip from './ExportSlip'
import { exportExcel, exportPDF, PRESETS, fmtPeriod } from '../../utils/export'
import ColumnPicker, { ColDef } from '../../components/ColumnPicker'

const fmt = (n: number) => new Intl.NumberFormat('vi-VN').format(n) + 'đ'
const STATUS_LABEL: any = { PENDING: 'Chờ xử lý', COMPLETED: 'Hoàn thành', CANCELLED: 'Đã hủy', REFUNDED: 'Hoàn hàng' }
const STATUS_CLASS: any = { PENDING: 'badge-yellow', COMPLETED: 'badge-green', CANCELLED: 'badge-red', REFUNDED: 'badge-blue' }
const PAY_LABEL: any = { CASH: 'Tiền mặt', CARD: 'Thẻ', TRANSFER: 'Chuyển khoản', DEBT: 'Ghi nợ', MIXED: 'Hỗn hợp' }

const TRANSITIONS: Record<string, { label: string; next: string; icon: any; cls: string }[]> = {
  PENDING: [
    { label: 'Xác nhận', next: 'COMPLETED', icon: CheckCircle, cls: 'text-green-600 hover:text-green-700' },
    { label: 'Hủy đơn',  next: 'CANCELLED', icon: XCircle,    cls: 'text-red-500 hover:text-red-700' },
  ],
  COMPLETED: [
    { label: 'Hoàn hàng', next: 'REFUNDED', icon: RotateCcw, cls: 'text-orange-500 hover:text-orange-700' },
    { label: 'Hủy đơn',   next: 'CANCELLED', icon: XCircle,  cls: 'text-red-500 hover:text-red-700' },
  ],
}

const COLS: ColDef[] = [
  { key: 'orderCode', label: 'Mã đơn' },
  { key: 'customer', label: 'Khách hàng' },
  { key: 'user', label: 'Nhân viên' },
  { key: 'paymentMethod', label: 'Thanh toán' },
  { key: 'total', label: 'Tổng tiền' },
  { key: 'status', label: 'Trạng thái' },
  { key: 'createdAt', label: 'Thời gian' },
]

export default function Orders() {
  const qc = useQueryClient()
  const now = new Date()
  const [from, setFrom] = useState(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10))
  const [to, setTo] = useState(now.toISOString().slice(0, 10))
  const [activePreset, setActivePreset] = useState('Tháng này')
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<any>(null)
  const [slipOrder, setSlipOrder] = useState<any>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [visible, setVisible] = useState<Set<string>>(() => new Set(COLS.map(c => c.key)))
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const applyPreset = (p: typeof PRESETS[number]) => {
    const [f, t] = p.getDates(); setFrom(f); setTo(t); setActivePreset(p.label); setPage(1)
  }

  const { data, isLoading } = useQuery({
    queryKey: ['orders', status, page, search, from, to],
    queryFn: () => api.get(`/orders?status=${status}&page=${page}&limit=20&search=${search}&from=${from}&to=${to}`).then(r => r.data)
  })

  const { mutate: updateStatus, isPending: isUpdating } = useMutation({
    mutationFn: ({ id, next }: { id: string; next: string }) =>
      api.patch(`/orders/${id}/status`, { status: next }).then(r => r.data),
    onSuccess: (updated) => {
      toast.success(`Đã cập nhật trạng thái: ${STATUS_LABEL[updated.status]}`)
      qc.invalidateQueries({ queryKey: ['orders'] })
      setSelected(updated)
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Lỗi cập nhật trạng thái')
  })

  const confirmTransition = (order: any, next: string) => {
    const msg: any = {
      COMPLETED: `Xác nhận hoàn thành đơn ${order.orderCode}? Kho sẽ được trừ hàng.`,
      CANCELLED: `Hủy đơn ${order.orderCode}? Thao tác này không thể hoàn tác.`,
      REFUNDED:  `Hoàn hàng đơn ${order.orderCode}? Kho sẽ được cộng lại.`,
    }
    if (window.confirm(msg[next] || 'Xác nhận?')) updateStatus({ id: order.id, next })
  }

  const getVal = (o: any, key: string) => {
    switch (key) {
      case 'orderCode': return o.orderCode
      case 'customer': return o.customer?.name || 'Khách lẻ'
      case 'user': return o.user?.name || ''
      case 'paymentMethod': return PAY_LABEL[o.paymentMethod]
      case 'total': return o.total
      case 'status': return STATUS_LABEL[o.status]
      case 'createdAt': return new Date(o.createdAt).toLocaleString('vi-VN')
      default: return ''
    }
  }

  const visCols = COLS.filter(c => visible.has(c.key))

  const exportData = selectedIds.size > 0
    ? (data?.data || []).filter((o: any) => selectedIds.has(o.id))
    : (data?.data || [])

  const handleExcel = () => {
    const headers = visCols.map(c => c.label)
    const rows = exportData.map((o: any) => visCols.map(c => getVal(o, c.key)))
    exportExcel(`Don-hang_${from}_${to}`, 'Don hang', headers, rows)
  }

  const handlePDF = () => {
    const headers = visCols.map(c => c.label)
    const rows = exportData.map((o: any) => visCols.map(c =>
      c.key === 'total' ? fmt(o.total) : getVal(o, c.key)
    ))
    exportPDF(`Don-hang_${from}_${to}`, 'Danh sach don hang', fmtPeriod(from, to), headers, rows)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold">Đơn hàng</h1>
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Tạo đơn hàng
        </button>
      </div>

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
            <input type="date" className="input text-sm py-1.5" value={from} onChange={e => { setFrom(e.target.value); setActivePreset(''); setPage(1) }} />
            <span className="text-sm text-gray-500">Đến:</span>
            <input type="date" className="input text-sm py-1.5" value={to} onChange={e => { setTo(e.target.value); setActivePreset(''); setPage(1) }} />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1.5">
          {[['', 'Tất cả'], ['COMPLETED', 'Hoàn thành'], ['PENDING', 'Chờ xử lý'], ['CANCELLED', 'Đã hủy'], ['REFUNDED', 'Hoàn hàng']].map(([val, label]) => (
            <button key={val} onClick={() => { setStatus(val); setPage(1) }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${status === val ? 'bg-blue-600 text-white' : 'bg-white border hover:bg-gray-50'}`}>
              {label}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pl-9 py-1.5 text-sm w-56" placeholder="Tìm mã đơn hàng..."
            value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} />
        </div>
        <div className="ml-auto flex gap-2 items-center">
          {selectedIds.size > 0 && (
            <span className="text-sm text-blue-600 font-medium">
              Đã chọn {selectedIds.size} đơn
            </span>
          )}
          {selectedIds.size > 0 && (
            <button onClick={() => setSelectedIds(new Set())}
              className="text-xs text-gray-400 hover:text-gray-600 underline">
              Bỏ chọn
            </button>
          )}
          <ColumnPicker cols={COLS} visible={visible} onChange={setVisible} />
          <button onClick={handleExcel} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-sm font-medium ${selectedIds.size > 0 ? 'bg-green-700' : 'bg-green-600 hover:bg-green-700'}`}>
            <FileSpreadsheet size={14} /> {selectedIds.size > 0 ? `Excel (${selectedIds.size})` : 'Excel'}
          </button>
          <button onClick={handlePDF} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-sm font-medium ${selectedIds.size > 0 ? 'bg-red-700' : 'bg-red-600 hover:bg-red-700'}`}>
            <FileText size={14} /> {selectedIds.size > 0 ? `PDF (${selectedIds.size})` : 'PDF'}
          </button>
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-3 py-3 w-10">
                  <input type="checkbox"
                    className="w-4 h-4 rounded cursor-pointer accent-blue-600"
                    checked={data?.data?.length > 0 && data.data.every((o: any) => selectedIds.has(o.id))}
                    onChange={e => {
                      const ids = data?.data?.map((o: any) => o.id) ?? []
                      if (e.target.checked) setSelectedIds(prev => new Set([...prev, ...ids]))
                      else setSelectedIds(prev => { const s = new Set(prev); ids.forEach((id: string) => s.delete(id)); return s })
                    }}
                  />
                </th>
                {visCols.map(c => (
                  <th key={c.key} className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">{c.label}</th>
                ))}
                <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading && <tr><td colSpan={visCols.length + 2} className="text-center py-10 text-gray-400">Đang tải...</td></tr>}
              {!isLoading && !data?.data?.length && <tr><td colSpan={visCols.length + 2} className="text-center py-10 text-gray-400">Không có đơn hàng nào</td></tr>}
              {data?.data?.map((o: any) => (
                <tr key={o.id} className={`hover:bg-gray-50 ${selectedIds.has(o.id) ? 'bg-blue-50' : ''}`}>
                  {visible.has('orderCode') && <td className="px-4 py-3 font-mono text-xs font-semibold text-blue-700">{o.orderCode}</td>}
                  {visible.has('customer') && (
                    <td className="px-4 py-3">
                      <p className="font-medium">{o.customer?.name || 'Khách lẻ'}</p>
                      {o.customer?.phone && <p className="text-xs text-gray-400">{o.customer.phone}</p>}
                    </td>
                  )}
                  {visible.has('user') && <td className="px-4 py-3 text-gray-500">{o.user?.name}</td>}
                  {visible.has('paymentMethod') && <td className="px-4 py-3"><span className="badge badge-blue">{PAY_LABEL[o.paymentMethod]}</span></td>}
                  {visible.has('total') && <td className="px-4 py-3 font-semibold text-blue-600 whitespace-nowrap">{fmt(o.total)}</td>}
                  {visible.has('status') && (
                    <td className="px-4 py-3">
                      {o.status === 'PENDING' ? (
                        <div className="flex flex-col gap-1">
                          <button onClick={() => confirmTransition(o, 'COMPLETED')} disabled={isUpdating}
                            className="px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-700 hover:bg-green-200 disabled:opacity-50 whitespace-nowrap">
                            Hoàn thành
                          </button>
                          <button onClick={() => confirmTransition(o, 'CANCELLED')} disabled={isUpdating}
                            className="px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-600 hover:bg-red-200 disabled:opacity-50 whitespace-nowrap">
                            Hủy đơn
                          </button>
                        </div>
                      ) : (
                        <span className={`badge ${STATUS_CLASS[o.status]}`}>{STATUS_LABEL[o.status]}</span>
                      )}
                    </td>
                  )}
                  {visible.has('createdAt') && <td className="px-4 py-3 text-gray-400 whitespace-nowrap text-xs">{new Date(o.createdAt).toLocaleString('vi-VN')}</td>}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button title="Chi tiết" onClick={() => setSelected(o)} className="text-blue-500 hover:text-blue-700"><Eye size={16} /></button>
                      <button title="Phiếu xuất hàng" onClick={() => setSlipOrder(o)} className="text-gray-500 hover:text-gray-700"><FileText size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t flex items-center justify-between text-sm text-gray-500">
          <span>Tổng: <strong>{data?.total || 0}</strong> đơn hàng</span>
          <div className="flex gap-2 items-center">
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="btn-outline px-3 py-1 text-xs disabled:opacity-40">Trước</button>
            <span className="px-2">Trang {page}</span>
            <button disabled={!data?.data?.length || data.data.length < 20} onClick={() => setPage(p => p + 1)} className="btn-outline px-3 py-1 text-xs disabled:opacity-40">Sau</button>
          </div>
        </div>
      </div>

      {selected && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-bold">{selected.orderCode}</h2>
                <span className={`badge ${STATUS_CLASS[selected.status]}`}>{STATUS_LABEL[selected.status]}</span>
              </div>
              <div className="flex items-center gap-2">
                <button title="In phiếu xuất hàng" onClick={() => { setSlipOrder(selected); setSelected(null) }}
                  className="btn-outline flex items-center gap-1.5 py-1.5 text-sm"><FileText size={15} /> In phiếu</button>
                <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 text-xl ml-1">x</button>
              </div>
            </div>
            <div className="overflow-y-auto p-6 space-y-5">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-gray-500">Khách hàng: </span><strong>{selected.customer?.name || 'Khách lẻ'}</strong></div>
                <div><span className="text-gray-500">SĐT: </span><strong>{selected.customer?.phone || '-'}</strong></div>
                <div><span className="text-gray-500">Nhân viên: </span><strong>{selected.user?.name}</strong></div>
                <div><span className="text-gray-500">Thanh toán: </span><strong>{PAY_LABEL[selected.paymentMethod]}</strong></div>
                <div><span className="text-gray-500">Thời gian: </span><strong>{new Date(selected.createdAt).toLocaleString('vi-VN')}</strong></div>
                {selected.note && <div className="col-span-2"><span className="text-gray-500">Ghi chú: </span><strong>{selected.note}</strong></div>}
              </div>
              {TRANSITIONS[selected.status]?.length > 0 && (
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-sm font-semibold text-gray-700 mb-3">Cập nhật trạng thái</p>
                  <div className="flex gap-3">
                    {TRANSITIONS[selected.status].map(({ label, next, icon: Icon, cls }) => (
                      <button key={next} onClick={() => confirmTransition(selected, next)} disabled={isUpdating}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg border bg-white text-sm font-medium transition-colors disabled:opacity-50 ${cls}`}>
                        <Icon size={15} /> {label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-2">Sản phẩm</p>
                <table className="w-full text-sm border rounded-lg overflow-hidden">
                  <thead className="bg-gray-50">
                    <tr>{['Sản phẩm', 'ĐVT', 'SL', 'Đơn giá', 'Thành tiền'].map(h => (
                      <th key={h} className="px-3 py-2 text-left font-medium text-gray-600">{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody className="divide-y">
                    {selected.items?.map((item: any) => (
                      <tr key={item.id}>
                        <td className="px-3 py-2"><p>{item.product?.name}</p><p className="text-gray-400 text-xs font-mono">{item.product?.code}</p></td>
                        <td className="px-3 py-2 text-gray-500">{item.unit || item.product?.unit || 'cai'}</td>
                        <td className="px-3 py-2 font-medium">{item.qty}</td>
                        <td className="px-3 py-2">{fmt(item.price)}</td>
                        <td className="px-3 py-2 font-semibold text-blue-600">{fmt(item.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end">
                <div className="w-64 space-y-1.5 text-sm">
                  <div className="flex justify-between"><span className="text-gray-500">Tạm tính</span><span>{fmt(selected.subtotal)}</span></div>
                  {selected.discount > 0 && <div className="flex justify-between text-red-500"><span>Giảm giá</span><span>- {fmt(selected.discount)}</span></div>}
                  <div className="flex justify-between font-bold text-base pt-2 border-t"><span>Tổng cộng</span><span className="text-blue-600">{fmt(selected.total)}</span></div>
                  {selected.amountPaid > 0 && <div className="flex justify-between text-gray-500 text-xs"><span>Tiền nhận</span><span>{fmt(selected.amountPaid)}</span></div>}
                  {selected.change > 0 && <div className="flex justify-between text-green-600 text-xs"><span>Tiền thối</span><span>{fmt(selected.change)}</span></div>}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showCreate && <CreateOrderModal onClose={() => setShowCreate(false)} onSuccess={(order) => { setShowCreate(false); setSelected(order) }} />}
      {slipOrder && <ExportSlip order={slipOrder} onClose={() => setSlipOrder(null)} />}
    </div>
  )
}

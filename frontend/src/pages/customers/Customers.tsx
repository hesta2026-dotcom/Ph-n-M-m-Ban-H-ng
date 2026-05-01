import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../../services/api'
import toast from 'react-hot-toast'
import { Plus, Search, Edit2, Trash2, ChevronRight, X, ShoppingBag, Calendar, FileSpreadsheet, FileText } from 'lucide-react'
import { exportExcel, exportPDF } from '../../utils/export'
import ColumnPicker, { ColDef } from '../../components/ColumnPicker'

const fmt = (n: number) => new Intl.NumberFormat('vi-VN').format(n) + 'đ'
const STATUS_LABEL: any = { PENDING: 'Chờ xử lý', COMPLETED: 'Hoàn thành', CANCELLED: 'Đã hủy', REFUNDED: 'Hoàn hàng' }
const STATUS_CLASS: any = { PENDING: 'badge-yellow', COMPLETED: 'badge-green', CANCELLED: 'badge-red', REFUNDED: 'badge-blue' }
const PAY_LABEL: any = { CASH: 'Tiền mặt', CARD: 'Thẻ', TRANSFER: 'Chuyển khoản', DEBT: 'Ghi nợ', MIXED: 'Hỗn hợp' }

const now = new Date()
const monthLabel = `Tháng ${now.getMonth() + 1}/${now.getFullYear()}`

const COLS: ColDef[] = [
  { key: 'name', label: 'Tên khách hàng' },
  { key: 'phone', label: 'SĐT' },
  { key: 'email', label: 'Email' },
  { key: 'address', label: 'Địa chỉ' },
  { key: 'orderValue', label: 'Giá trị đơn hàng' },
  { key: 'monthlyRevenue', label: `DS cộng dồn (${monthLabel})` },
  { key: 'monthlyCount', label: `Lần mua (${monthLabel})` },
  { key: 'debt', label: 'Công nợ' },
]

const emptyForm = { name: '', phone: '', email: '', address: '' }

export default function Customers() {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form, setForm] = useState(emptyForm)
  const [viewCustomer, setViewCustomer] = useState<any>(null)
  const [viewOrder, setViewOrder] = useState<any>(null)
  const [visible, setVisible] = useState<Set<string>>(() => new Set(COLS.map(c => c.key)))
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['customers', search, page],
    queryFn: () => api.get(`/customers?search=${search}&page=${page}&limit=20`).then(r => r.data)
  })

  const { data: customerOrders } = useQuery({
    queryKey: ['customer-orders', viewCustomer?.id],
    queryFn: () => api.get(`/customers/${viewCustomer.id}/orders`).then(r => r.data),
    enabled: !!viewCustomer
  })

  const save = useMutation({
    mutationFn: (d: any) => editing ? api.put(`/customers/${editing.id}`, d) : api.post('/customers', d),
    onSuccess: () => { toast.success('Đã lưu'); qc.invalidateQueries({ queryKey: ['customers'] }); setShowForm(false); setEditing(null); setForm(emptyForm) },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Lỗi')
  })

  const del = useMutation({
    mutationFn: (id: string) => api.delete(`/customers/${id}`),
    onSuccess: () => { toast.success('Đã xóa khách hàng'); qc.invalidateQueries({ queryKey: ['customers'] }) },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Không thể xóa')
  })

  const totalOrderCount = customerOrders?.length ?? 0
  const totalSpent = customerOrders?.filter((o: any) => o.status === 'COMPLETED').reduce((s: number, o: any) => s + o.total, 0) ?? 0

  const getVal = (c: any, key: string) => {
    switch (key) {
      case 'name': return c.name
      case 'phone': return c.phone || ''
      case 'email': return c.email || ''
      case 'address': return c.address || ''
      case 'orderValue': return c.orderValue || 0
      case 'monthlyRevenue': return c.monthlyRevenue || 0
      case 'monthlyCount': return c.monthlyCount || 0
      case 'debt': return c.debt || 0
      default: return ''
    }
  }

  const visCols = COLS.filter(c => visible.has(c.key))

  const handleExcel = () => {
    const headers = visCols.map(c => c.label)
    const rows = (data?.data || []).map((c: any) => visCols.map(col => getVal(c, col.key)))
    exportExcel('Khach-hang', 'Khach hang', headers, rows)
  }

  const handlePDF = () => {
    const headers = visCols.map(c => c.label)
    const rows = (data?.data || []).map((c: any) => visCols.map(col => {
      const v = getVal(c, col.key)
      if (col.key === 'orderValue' || col.key === 'monthlyRevenue') return fmt(v as number)
      if (col.key === 'debt') return (v as number) > 0 ? fmt(v as number) : '-'
      return v
    }))
    exportPDF('Khach-hang', 'Danh sach khach hang', `Tổng: ${data?.total || 0} khách hàng`, headers, rows)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold">Khách hàng</h1>
        <div className="flex gap-2 items-center">
          <ColumnPicker cols={COLS} visible={visible} onChange={setVisible} />
          <button onClick={handleExcel} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700">
            <FileSpreadsheet size={15} /> Excel
          </button>
          <button onClick={handlePDF} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700">
            <FileText size={15} /> PDF
          </button>
          <button onClick={() => { setEditing(null); setForm(emptyForm); setShowForm(true) }} className="btn-primary flex items-center gap-2"><Plus size={18} /> Thêm khách hàng</button>
        </div>
      </div>
      <div className="relative">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input className="input pl-10" placeholder="Tìm theo tên, số điện thoại..." value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} />
      </div>

      <div className="card p-0 overflow-hidden overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              {visCols.map(c => (
                <th key={c.key} className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">{c.label}</th>
              ))}
              <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading && <tr><td colSpan={visCols.length + 1} className="text-center py-10 text-gray-400">Đang tải...</td></tr>}
            {!isLoading && !data?.data?.length && <tr><td colSpan={visCols.length + 1} className="text-center py-10 text-gray-400">Không có khách hàng</td></tr>}
            {data?.data?.map((c: any) => (
              <tr key={c.id} className="hover:bg-gray-50">
                {visible.has('name') && (
                  <td className="px-4 py-3">
                    <button onClick={() => setViewCustomer(c)} className="font-medium text-blue-700 hover:text-blue-900 flex items-center gap-1 whitespace-nowrap">
                      {c.name} <ChevronRight size={14} />
                    </button>
                  </td>
                )}
                {visible.has('phone') && <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{c.phone || '-'}</td>}
                {visible.has('email') && <td className="px-4 py-3 text-gray-500 text-xs">{c.email || '-'}</td>}
                {visible.has('address') && <td className="px-4 py-3 text-gray-500 text-xs max-w-[140px] truncate">{c.address || '-'}</td>}
                {visible.has('orderValue') && <td className="px-4 py-3 text-blue-600 font-medium whitespace-nowrap">{fmt(c.orderValue || 0)}</td>}
                {visible.has('monthlyRevenue') && (
                  <td className="px-4 py-3 text-green-600 font-semibold whitespace-nowrap">
                    {c.monthlyRevenue > 0 ? fmt(c.monthlyRevenue) : <span className="text-gray-400">0đ</span>}
                  </td>
                )}
                {visible.has('monthlyCount') && (
                  <td className="px-4 py-3 text-center">
                    {c.monthlyCount > 0
                      ? <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                          <Calendar size={11} />{c.monthlyCount}
                        </span>
                      : <span className="text-gray-400">0</span>}
                  </td>
                )}
                {visible.has('debt') && (
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={c.debt > 0 ? 'badge badge-red' : 'text-gray-400'}>{c.debt > 0 ? fmt(c.debt) : '-'}</span>
                  </td>
                )}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button onClick={() => { setEditing(c); setForm({ name: c.name, phone: c.phone || '', email: c.email || '', address: c.address || '' }); setShowForm(true) }}
                      className="text-blue-500 hover:text-blue-700"><Edit2 size={15} /></button>
                    <button onClick={() => { if (confirm(`Xóa khách hàng "${c.name}"?`)) del.mutate(c.id) }}
                      className="text-red-400 hover:text-red-600"><Trash2 size={15} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-4 py-3 border-t flex items-center justify-between text-sm text-gray-500">
          <span>Tổng: <strong>{data?.total || 0}</strong> khách hàng</span>
          <div className="flex gap-2">
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="btn-outline px-3 py-1 text-xs disabled:opacity-40">Trước</button>
            <span className="px-2">Trang {page}</span>
            <button disabled={!data?.data?.length || data.data.length < 20} onClick={() => setPage(p => p + 1)} className="btn-outline px-3 py-1 text-xs disabled:opacity-40">Sau</button>
          </div>
        </div>
      </div>

      {viewCustomer && !viewOrder && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0">
              <h2 className="text-lg font-bold">{viewCustomer.name}</h2>
              <button onClick={() => setViewCustomer(null)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="overflow-y-auto p-6 space-y-5">
              <div className="grid grid-cols-2 gap-3 text-sm bg-gray-50 rounded-xl p-4">
                <div><span className="text-gray-500">Họ tên: </span><strong>{viewCustomer.name}</strong></div>
                <div><span className="text-gray-500">SĐT: </span><strong>{viewCustomer.phone || '—'}</strong></div>
                <div><span className="text-gray-500">Email: </span><strong>{viewCustomer.email || '—'}</strong></div>
                <div><span className="text-gray-500">Địa chỉ: </span><strong>{viewCustomer.address || '—'}</strong></div>
              </div>
              <div className="grid grid-cols-4 gap-3">
                <div className="card p-4 text-center">
                  <p className="text-xs text-gray-500 mb-1">Tổng đơn hàng</p>
                  <p className="text-2xl font-bold text-blue-600">{totalOrderCount}</p>
                </div>
                <div className="card p-4 text-center">
                  <p className="text-xs text-gray-500 mb-1">Giá trị đơn hàng</p>
                  <p className="text-base font-bold text-blue-600">{fmt(viewCustomer.orderValue || 0)}</p>
                </div>
                <div className="card p-4 text-center">
                  <p className="text-xs text-gray-500 mb-1">DS cộng dồn tháng này</p>
                  <p className="text-base font-bold text-green-600">{fmt(viewCustomer.monthlyRevenue || 0)}</p>
                </div>
                <div className="card p-4 text-center">
                  <p className="text-xs text-gray-500 mb-1">Lần mua tháng này</p>
                  <p className="text-2xl font-bold text-yellow-500">{viewCustomer.monthlyCount || 0}</p>
                </div>
              </div>
              <div>
                <p className="font-semibold text-gray-700 mb-2 flex items-center gap-2"><ShoppingBag size={16} /> Lịch sử đơn hàng</p>
                <div className="border rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        {['Mã đơn', 'Sản phẩm', 'Thanh toán', 'Tổng tiền', 'Trạng thái', 'Ngày tạo'].map(h => (
                          <th key={h} className="px-3 py-2 text-left font-medium text-gray-600 whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {!customerOrders && <tr><td colSpan={6} className="text-center py-6 text-gray-400">Đang tải...</td></tr>}
                      {customerOrders?.length === 0 && <tr><td colSpan={6} className="text-center py-6 text-gray-400">Chưa có đơn hàng nào</td></tr>}
                      {customerOrders?.map((o: any) => (
                        <tr key={o.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setViewOrder(o)}>
                          <td className="px-3 py-2 font-mono text-xs font-semibold text-blue-700">{o.orderCode}</td>
                          <td className="px-3 py-2 text-gray-500 text-xs">
                            {o.items?.slice(0, 2).map((i: any) => i.product?.name).join(', ')}
                            {o.items?.length > 2 && ` +${o.items.length - 2}`}
                          </td>
                          <td className="px-3 py-2"><span className="badge badge-blue text-xs">{PAY_LABEL[o.paymentMethod]}</span></td>
                          <td className="px-3 py-2 font-semibold text-blue-600 whitespace-nowrap">{fmt(o.total)}</td>
                          <td className="px-3 py-2"><span className={`badge ${STATUS_CLASS[o.status]}`}>{STATUS_LABEL[o.status]}</span></td>
                          <td className="px-3 py-2 text-gray-400 text-xs whitespace-nowrap">{new Date(o.createdAt).toLocaleString('vi-VN')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {viewOrder && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0">
              <div className="flex items-center gap-3">
                <button onClick={() => setViewOrder(null)} className="text-gray-400 hover:text-gray-600 text-sm flex items-center gap-1">← Quay lại</button>
                <span className="text-gray-300">|</span>
                <h2 className="font-bold">{viewOrder.orderCode}</h2>
                <span className={`badge ${STATUS_CLASS[viewOrder.status]}`}>{STATUS_LABEL[viewOrder.status]}</span>
              </div>
              <button onClick={() => { setViewOrder(null); setViewCustomer(null) }} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="overflow-y-auto p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm bg-gray-50 rounded-xl p-4">
                <div><span className="text-gray-500">Khách hàng: </span><strong>{viewOrder.customer?.name || 'Khách lẻ'}</strong></div>
                <div><span className="text-gray-500">SĐT: </span><strong>{viewOrder.customer?.phone || '—'}</strong></div>
                <div><span className="text-gray-500">Thanh toán: </span><strong>{PAY_LABEL[viewOrder.paymentMethod]}</strong></div>
                <div><span className="text-gray-500">Ngày tạo: </span><strong>{new Date(viewOrder.createdAt).toLocaleString('vi-VN')}</strong></div>
                {viewOrder.note && <div className="col-span-2"><span className="text-gray-500">Ghi chú: </span><strong>{viewOrder.note}</strong></div>}
              </div>
              <table className="w-full text-sm border rounded-xl overflow-hidden">
                <thead className="bg-gray-50">
                  <tr>{['Sản phẩm', 'ĐVT', 'SL', 'Đơn giá', 'Thành tiền'].map(h => (
                    <th key={h} className="px-3 py-2 text-left font-medium text-gray-600">{h}</th>
                  ))}</tr>
                </thead>
                <tbody className="divide-y">
                  {viewOrder.items?.map((item: any, idx: number) => (
                    <tr key={idx}>
                      <td className="px-3 py-2"><p>{item.product?.name}</p><p className="text-gray-400 text-xs font-mono">{item.product?.code}</p></td>
                      <td className="px-3 py-2 text-gray-500">{item.unit || item.product?.unit || 'cái'}</td>
                      <td className="px-3 py-2 font-medium">{item.qty}</td>
                      <td className="px-3 py-2">{fmt(item.price)}</td>
                      <td className="px-3 py-2 font-semibold text-blue-600">{fmt(item.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex justify-end">
                <div className="w-56 space-y-1.5 text-sm">
                  <div className="flex justify-between"><span className="text-gray-500">Tạm tính</span><span>{fmt(viewOrder.subtotal)}</span></div>
                  {viewOrder.discount > 0 && <div className="flex justify-between text-red-500"><span>Giảm giá</span><span>-{fmt(viewOrder.discount)}</span></div>}
                  <div className="flex justify-between font-bold text-base pt-2 border-t">
                    <span>Tổng cộng</span><span className="text-blue-600">{fmt(viewOrder.total)}</span>
                  </div>
                  {viewOrder.amountPaid > 0 && <div className="flex justify-between text-gray-500 text-xs"><span>Tiền nhận</span><span>{fmt(viewOrder.amountPaid)}</span></div>}
                  {viewOrder.change > 0 && <div className="flex justify-between text-green-600 text-xs"><span>Tiền thối</span><span>{fmt(viewOrder.change)}</span></div>}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold mb-4">{editing ? 'Sửa khách hàng' : 'Thêm khách hàng'}</h2>
            <form onSubmit={e => { e.preventDefault(); save.mutate(form) }} className="space-y-3">
              {[['Họ tên *', 'name'], ['Số điện thoại', 'phone'], ['Email', 'email'], ['Địa chỉ', 'address']].map(([label, key]) => (
                <div key={key}>
                  <label className="block text-sm font-medium mb-1">{label}</label>
                  <input className="input" value={(form as any)[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} required={label.includes('*')} />
                </div>
              ))}
              <div className="flex gap-3 justify-end pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="btn-outline">Hủy</button>
                <button type="submit" disabled={save.isPending} className="btn-primary">{save.isPending ? 'Đang lưu...' : 'Lưu'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../../services/api'
import toast from 'react-hot-toast'
import { Plus, Search, Edit2, Trash2, X, Package, ChevronRight, FileSpreadsheet, FileText } from 'lucide-react'
import ColumnPicker, { ColDef } from '../../components/ColumnPicker'
import { exportExcel, exportPDF } from '../../utils/export'

const fmt = (n: number) => new Intl.NumberFormat('vi-VN').format(n) + 'đ'
const emptyForm = { name: '', phone: '', email: '', address: '', taxCode: '' }

const COLS: ColDef[] = [
  { key: 'name', label: 'Tên NCC' },
  { key: 'phone', label: 'SĐT' },
  { key: 'email', label: 'Email' },
  { key: 'taxCode', label: 'Mã số thuế' },
  { key: 'debt', label: 'Công nợ' },
]

export default function Suppliers() {
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form, setForm] = useState(emptyForm)
  const [viewSupplier, setViewSupplier] = useState<any>(null)
  const [viewPurchase, setViewPurchase] = useState<any>(null)
  const [visible, setVisible] = useState<Set<string>>(() => new Set(COLS.map(c => c.key)))
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const qc = useQueryClient()

  const { data } = useQuery({
    queryKey: ['suppliers', search],
    queryFn: () => api.get(`/suppliers?search=${search}`).then(r => r.data)
  })

  const { data: supplierPurchases } = useQuery({
    queryKey: ['supplier-purchases', viewSupplier?.id],
    queryFn: () => api.get(`/purchases?supplierId=${viewSupplier.id}&limit=100`).then(r => r.data),
    enabled: !!viewSupplier
  })

  const save = useMutation({
    mutationFn: (d: any) => editing ? api.put(`/suppliers/${editing.id}`, d) : api.post('/suppliers', d),
    onSuccess: () => {
      toast.success('Đã lưu')
      qc.invalidateQueries({ queryKey: ['suppliers'] })
      setShowForm(false); setEditing(null); setForm(emptyForm)
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Lỗi')
  })

  const del = useMutation({
    mutationFn: (id: string) => api.delete(`/suppliers/${id}`),
    onSuccess: () => { toast.success('Đã xóa nhà cung cấp'); qc.invalidateQueries({ queryKey: ['suppliers'] }) },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Không thể xóa')
  })

  const delBulk = async () => {
    if (!confirm(`Xóa ${selectedIds.size} nhà cung cấp đã chọn?`)) return
    const results = await Promise.allSettled([...selectedIds].map(id => api.delete(`/suppliers/${id}`)))
    const ok = results.filter(r => r.status === 'fulfilled').length
    const fail = results.length - ok
    if (ok > 0) { toast.success(`Đã xóa ${ok} nhà cung cấp`); qc.invalidateQueries({ queryKey: ['suppliers'] }); setSelectedIds(new Set()) }
    if (fail > 0) toast.error(`${fail} NCC không thể xóa (còn phiếu nhập)`)
  }

  const totalPurchased = supplierPurchases?.data?.reduce((s: number, p: any) => s + p.total, 0) ?? 0
  const totalPaid     = supplierPurchases?.data?.reduce((s: number, p: any) => s + p.paid,  0) ?? 0

  const visCols = COLS.filter(c => visible.has(c.key))

  const getVal = (s: any, key: string) => {
    switch (key) {
      case 'name': return s.name
      case 'phone': return s.phone || '-'
      case 'email': return s.email || '-'
      case 'taxCode': return s.taxCode || '-'
      case 'debt': return s.debt
      default: return ''
    }
  }

  const handleExcelSuppliers = () => {
    const rows = (data || []).map((s: any) => visCols.map(c => getVal(s, c.key)))
    exportExcel(`Nha-cung-cap_${new Date().toISOString().slice(0, 10)}`, 'Nhà cung cấp', visCols.map(c => c.label), rows)
  }

  const handlePDFSuppliers = () => {
    const rows = (data || []).map((s: any) => visCols.map(c =>
      c.key === 'debt' ? fmt(s.debt) : String(getVal(s, c.key))
    ))
    exportPDF(`Nha-cung-cap_${new Date().toISOString().slice(0, 10)}`, 'Danh sách nhà cung cấp', '', visCols.map(c => c.label), rows)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">Nhà cung cấp</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <ColumnPicker cols={COLS} visible={visible} onChange={setVisible} />
          <button onClick={handleExcelSuppliers} className="flex items-center gap-1.5 text-sm btn-outline">
            <FileSpreadsheet size={15} /> Excel
          </button>
          <button onClick={handlePDFSuppliers} className="flex items-center gap-1.5 text-sm btn-outline">
            <FileText size={15} /> PDF
          </button>
          {selectedIds.size > 0 && (
            <>
              <button onClick={delBulk} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700">
                <Trash2 size={14} /> Xóa ({selectedIds.size})
              </button>
              <button onClick={() => setSelectedIds(new Set())} className="text-xs text-gray-400 hover:text-gray-600 underline">Bỏ chọn</button>
            </>
          )}
          <button onClick={() => { setEditing(null); setForm(emptyForm); setShowForm(true) }}
            className="btn-primary flex items-center gap-2"><Plus size={18} /> Thêm NCC</button>
        </div>
      </div>

      <div className="relative">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input className="input pl-10" placeholder="Tìm theo tên, SĐT..."
          value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              {visCols.map(c => <th key={c.key} className="px-4 py-3 text-left font-medium text-gray-600">{c.label}</th>)}
              <th className="px-4 py-3 text-left font-medium text-gray-600">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {data?.map((s: any) => (
              <tr key={s.id} className="hover:bg-gray-50">
                {visible.has('name') && <td className="px-4 py-3">
                  <button onClick={() => setViewSupplier(s)}
                    className="font-medium text-left hover:text-blue-600 hover:underline flex items-center gap-1">
                    {s.name} <ChevronRight size={14} className="text-gray-400" />
                  </button>
                </td>}
                {visible.has('phone') && <td className="px-4 py-3 text-gray-500">{s.phone || '-'}</td>}
                {visible.has('email') && <td className="px-4 py-3 text-gray-500">{s.email || '-'}</td>}
                {visible.has('taxCode') && <td className="px-4 py-3 text-gray-500">{s.taxCode || '-'}</td>}
                {visible.has('debt') && <td className="px-4 py-3">
                  {s.debt > 0
                    ? <button onClick={() => setViewSupplier(s)} className="badge badge-red hover:opacity-80">{fmt(s.debt)}</button>
                    : <span className="text-gray-400">-</span>}
                </td>}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button onClick={() => { setEditing(s); setForm({ name: s.name, phone: s.phone || '', email: s.email || '', address: s.address || '', taxCode: s.taxCode || '' }); setShowForm(true) }}
                      className="text-blue-500 hover:text-blue-700"><Edit2 size={15} /></button>
                    <button onClick={() => { if (confirm(`Xóa nhà cung cấp "${s.name}"?`)) del.mutate(s.id) }}
                      className="text-red-400 hover:text-red-600"><Trash2 size={15} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ==================== Modal chi tiết nhà cung cấp ==================== */}
      {viewSupplier && !viewPurchase && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setViewSupplier(null)}>
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="px-6 py-4 border-b flex items-center justify-between flex-shrink-0">
              <div>
                <h2 className="text-lg font-bold">{viewSupplier.name}</h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  {[viewSupplier.phone, viewSupplier.email].filter(Boolean).join(' · ')}
                </p>
              </div>
              <button onClick={() => setViewSupplier(null)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>

            <div className="overflow-y-auto p-6 space-y-5">
              {/* Tổng quan */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-blue-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-blue-500 font-medium mb-1">Tổng mua hàng</p>
                  <p className="font-bold text-blue-700">{fmt(totalPurchased)}</p>
                </div>
                <div className="bg-green-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-green-500 font-medium mb-1">Đã thanh toán</p>
                  <p className="font-bold text-green-700">{fmt(totalPaid)}</p>
                </div>
                <div className={`rounded-xl p-3 text-center ${viewSupplier.debt > 0 ? 'bg-red-50' : 'bg-gray-50'}`}>
                  <p className={`text-xs font-medium mb-1 ${viewSupplier.debt > 0 ? 'text-red-500' : 'text-gray-400'}`}>Còn nợ</p>
                  <p className={`font-bold ${viewSupplier.debt > 0 ? 'text-red-600' : 'text-gray-400'}`}>{fmt(viewSupplier.debt)}</p>
                </div>
              </div>

              {/* Danh sách phiếu nhập */}
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-2">
                  Lịch sử nhập hàng ({supplierPurchases?.total ?? 0} phiếu)
                </p>
                {!supplierPurchases ? (
                  <p className="text-center py-8 text-gray-400 text-sm">Đang tải...</p>
                ) : supplierPurchases.data?.length === 0 ? (
                  <p className="text-center py-8 text-gray-400 text-sm">Chưa có phiếu nhập nào</p>
                ) : (
                  <div className="border rounded-xl overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          {['Mã phiếu', 'Số SP', 'Tổng tiền', 'Đã trả', 'Còn nợ', 'Trạng thái', 'Ngày nhập'].map(h => (
                            <th key={h} className="px-3 py-2.5 text-left font-medium text-gray-600 whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {supplierPurchases.data.map((p: any) => (
                          <tr key={p.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setViewPurchase(p)}>
                            <td className="px-3 py-2.5 font-mono text-xs font-semibold text-blue-600">{p.code}</td>
                            <td className="px-3 py-2.5 text-gray-500">{p.items?.length ?? 0} SP</td>
                            <td className="px-3 py-2.5 font-semibold whitespace-nowrap">{fmt(p.total)}</td>
                            <td className="px-3 py-2.5 text-green-600 whitespace-nowrap">{fmt(p.paid)}</td>
                            <td className="px-3 py-2.5 text-red-500 whitespace-nowrap">{p.debt > 0 ? fmt(p.debt) : '-'}</td>
                            <td className="px-3 py-2.5">
                              <span className={`badge text-xs ${p.status === 'COMPLETED' ? 'badge-green' : p.status === 'CANCELLED' ? 'badge-red' : 'badge-yellow'}`}>
                                {p.status === 'COMPLETED' ? 'Hoàn thành' : p.status === 'CANCELLED' ? 'Đã hủy' : 'Chờ xử lý'}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-gray-400 text-xs whitespace-nowrap">{new Date(p.createdAt).toLocaleDateString('vi-VN')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            <div className="px-6 py-4 border-t flex-shrink-0 flex justify-end">
              <button onClick={() => setViewSupplier(null)} className="btn-outline px-6">Đóng</button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== Modal chi tiết 1 phiếu nhập ==================== */}
      {viewPurchase && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4" onClick={() => setViewPurchase(null)}>
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b flex items-center justify-between flex-shrink-0">
              <div>
                <h2 className="text-lg font-bold">Chi tiết phiếu nhập</h2>
                <p className="text-sm font-mono text-blue-600 mt-0.5">{viewPurchase.code}</p>
              </div>
              <button onClick={() => setViewPurchase(null)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>

            <div className="overflow-y-auto p-6 space-y-5">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="bg-gray-50 rounded-xl p-3 space-y-1">
                  <p className="text-gray-500 text-xs font-medium uppercase tracking-wide">Nhà cung cấp</p>
                  <p className="font-semibold">{viewPurchase.supplier?.name}</p>
                  {viewPurchase.supplier?.phone && <p className="text-gray-500 text-xs">{viewPurchase.supplier.phone}</p>}
                </div>
                <div className="bg-gray-50 rounded-xl p-3 space-y-1">
                  <p className="text-gray-500 text-xs font-medium uppercase tracking-wide">Ngày nhập</p>
                  <p className="font-semibold">{new Date(viewPurchase.createdAt).toLocaleString('vi-VN')}</p>
                  <span className={`badge text-xs ${viewPurchase.status === 'COMPLETED' ? 'badge-green' : 'badge-yellow'}`}>
                    {viewPurchase.status === 'COMPLETED' ? 'Hoàn thành' : 'Chờ xử lý'}
                  </span>
                </div>
              </div>

              {/* Bảng sản phẩm */}
              <div className="border rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>{['Sản phẩm', 'Đơn vị', 'SL', 'Giá nhập', 'Thành tiền'].map(h =>
                      <th key={h} className="px-3 py-2.5 text-left font-medium text-gray-600 whitespace-nowrap">{h}</th>)}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {viewPurchase.items?.map((item: any) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                              {item.product?.image
                                ? <img src={item.product.image} alt="" className="w-full h-full object-cover" />
                                : <Package size={12} className="text-gray-400" />}
                            </div>
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

              {/* Tổng kết */}
              <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
                <div className="flex justify-between font-bold text-base">
                  <span>Tổng giá trị</span>
                  <span className="text-blue-600">{fmt(viewPurchase.total)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Đã trả</span>
                  <span className="text-green-600 font-medium">{fmt(viewPurchase.paid)}</span>
                </div>
                {viewPurchase.debt > 0 && (
                  <div className="flex justify-between font-medium text-red-500 pt-1 border-t border-gray-200">
                    <span>Còn nợ</span>
                    <span>{fmt(viewPurchase.debt)}</span>
                  </div>
                )}
              </div>

              {viewPurchase.note && (
                <div className="text-sm">
                  <p className="text-gray-500 font-medium mb-1">Ghi chú</p>
                  <p className="bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 text-gray-700">{viewPurchase.note}</p>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t flex-shrink-0 flex justify-between">
              <button onClick={() => setViewPurchase(null)} className="btn-outline">← Quay lại</button>
              <button onClick={() => { setViewPurchase(null); setViewSupplier(null) }} className="btn-outline px-6">Đóng</button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== Modal thêm/sửa NCC ==================== */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold mb-4">{editing ? 'Sửa NCC' : 'Thêm nhà cung cấp'}</h2>
            <form onSubmit={e => { e.preventDefault(); save.mutate(form) }} className="space-y-3">
              {[['Tên NCC *', 'name'], ['SĐT', 'phone'], ['Email', 'email'], ['Địa chỉ', 'address'], ['Mã số thuế', 'taxCode']].map(([label, key]) => (
                <div key={key}>
                  <label className="block text-sm font-medium mb-1">{label}</label>
                  <input className="input" value={(form as any)[key]}
                    onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} required={label.includes('*')} />
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

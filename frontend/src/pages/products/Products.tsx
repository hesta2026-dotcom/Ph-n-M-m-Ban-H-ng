import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../../services/api'
import toast from 'react-hot-toast'
import { Plus, Search, Edit2, Trash2, Package } from 'lucide-react'

const fmt = (n: number) => new Intl.NumberFormat('vi-VN').format(n) + 'đ'

const emptyForm = { name: '', code: '', barcode: '', price: 0, costPrice: 0, stock: 0, minStock: 5, unit: 'cái', categoryId: '', supplierId: '', description: '' }

export default function Products() {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form, setForm] = useState(emptyForm)
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['products', search, page],
    queryFn: () => api.get(`/products?search=${search}&page=${page}&limit=20`).then(r => r.data)
  })

  const { data: categories } = useQuery({ queryKey: ['categories'], queryFn: () => api.get('/categories').then(r => r.data) })
  const { data: suppliers } = useQuery({ queryKey: ['suppliers'], queryFn: () => api.get('/suppliers').then(r => r.data) })

  const save = useMutation({
    mutationFn: (d: any) => editing ? api.put(`/products/${editing.id}`, d) : api.post('/products', d),
    onSuccess: () => { toast.success(editing ? 'Đã cập nhật' : 'Đã thêm sản phẩm'); qc.invalidateQueries({ queryKey: ['products'] }); setShowForm(false); setEditing(null); setForm(emptyForm) },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Lỗi')
  })

  const del = useMutation({
    mutationFn: (id: string) => api.delete(`/products/${id}`),
    onSuccess: () => { toast.success('Đã xóa'); qc.invalidateQueries({ queryKey: ['products'] }) }
  })

  const openEdit = (p: any) => { setEditing(p); setForm({ name: p.name, code: p.code, barcode: p.barcode || '', price: p.price, costPrice: p.costPrice, stock: p.stock, minStock: p.minStock, unit: p.unit, categoryId: p.categoryId || '', supplierId: p.supplierId || '', description: p.description || '' }); setShowForm(true) }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Sản phẩm</h1>
        <button onClick={() => { setEditing(null); setForm(emptyForm); setShowForm(true) }} className="btn-primary flex items-center gap-2"><Plus size={18} /> Thêm sản phẩm</button>
      </div>

      <div className="relative">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input className="input pl-10" placeholder="Tìm theo tên, mã, barcode..." value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} />
      </div>

      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>{['Mã SP', 'Tên sản phẩm', 'Danh mục', 'Giá bán', 'Giá vốn', 'Tồn kho', 'Thao tác'].map(h => <th key={h} className="px-4 py-3 text-left font-medium text-gray-600">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y">
            {isLoading && <tr><td colSpan={7} className="text-center py-10 text-gray-400">Đang tải...</td></tr>}
            {data?.data?.map((p: any) => (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-xs text-gray-500">{p.code}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Package size={16} className="text-gray-400" />
                    <span className="font-medium">{p.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-500">{p.category?.name || '-'}</td>
                <td className="px-4 py-3 text-blue-600 font-semibold">{fmt(p.price)}</td>
                <td className="px-4 py-3 text-gray-500">{fmt(p.costPrice)}</td>
                <td className="px-4 py-3">
                  <span className={`badge ${p.stock <= p.minStock ? 'badge-red' : 'badge-green'}`}>{p.stock} {p.unit}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button onClick={() => openEdit(p)} className="text-blue-500 hover:text-blue-700"><Edit2 size={15} /></button>
                    <button onClick={() => { if (confirm('Xóa sản phẩm này?')) del.mutate(p.id) }} className="text-red-400 hover:text-red-600"><Trash2 size={15} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-4 py-3 border-t flex items-center justify-between text-sm text-gray-500">
          <span>Tổng: {data?.total || 0} sản phẩm</span>
          <div className="flex gap-2">
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="btn-outline px-3 py-1 text-xs disabled:opacity-40">Trước</button>
            <span className="px-3 py-1">Trang {page}</span>
            <button disabled={data?.data?.length < 20} onClick={() => setPage(p => p + 1)} className="btn-outline px-3 py-1 text-xs disabled:opacity-40">Sau</button>
          </div>
        </div>
      </div>

      {/* Modal form */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b flex items-center justify-between">
              <h2 className="text-lg font-bold">{editing ? 'Sửa sản phẩm' : 'Thêm sản phẩm mới'}</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <form onSubmit={e => { e.preventDefault(); save.mutate(form) }} className="p-6 grid grid-cols-2 gap-4">
              {[['Tên sản phẩm *', 'name', 'text'], ['Mã sản phẩm *', 'code', 'text'], ['Barcode', 'barcode', 'text'], ['Đơn vị tính', 'unit', 'text'], ['Giá bán *', 'price', 'number'], ['Giá vốn', 'costPrice', 'number'], ['Tồn kho', 'stock', 'number'], ['Tồn kho tối thiểu', 'minStock', 'number']].map(([label, key, type]) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                  <input className="input" type={type} value={(form as any)[key]} onChange={e => setForm(p => ({ ...p, [key]: type === 'number' ? +e.target.value : e.target.value }))} required={label.includes('*')} />
                </div>
              ))}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Danh mục</label>
                <select className="input" value={form.categoryId} onChange={e => setForm(p => ({ ...p, categoryId: e.target.value }))}>
                  <option value="">-- Chọn danh mục --</option>
                  {categories?.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nhà cung cấp</label>
                <select className="input" value={form.supplierId} onChange={e => setForm(p => ({ ...p, supplierId: e.target.value }))}>
                  <option value="">-- Chọn NCC --</option>
                  {suppliers?.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Mô tả</label>
                <textarea className="input" rows={3} value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
              </div>
              <div className="col-span-2 flex gap-3 justify-end">
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

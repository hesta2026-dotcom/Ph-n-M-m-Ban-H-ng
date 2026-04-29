import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../../services/api'
import toast from 'react-hot-toast'
import { Plus, Search, Edit2, Star } from 'lucide-react'

const fmt = (n: number) => new Intl.NumberFormat('vi-VN').format(n) + 'đ'

const emptyForm = { name: '', phone: '', email: '', address: '' }

export default function Customers() {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form, setForm] = useState(emptyForm)
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['customers', search, page],
    queryFn: () => api.get(`/customers?search=${search}&page=${page}&limit=20`).then(r => r.data)
  })

  const save = useMutation({
    mutationFn: (d: any) => editing ? api.put(`/customers/${editing.id}`, d) : api.post('/customers', d),
    onSuccess: () => { toast.success('Đã lưu'); qc.invalidateQueries({ queryKey: ['customers'] }); setShowForm(false); setEditing(null); setForm(emptyForm) },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Lỗi')
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Khách hàng</h1>
        <button onClick={() => { setEditing(null); setForm(emptyForm); setShowForm(true) }} className="btn-primary flex items-center gap-2"><Plus size={18} /> Thêm khách hàng</button>
      </div>
      <div className="relative">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input className="input pl-10" placeholder="Tìm theo tên, số điện thoại..." value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} />
      </div>
      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b"><tr>{['Tên khách hàng', 'SĐT', 'Điểm tích lũy', 'Tổng chi tiêu', 'Công nợ', 'Thao tác'].map(h => <th key={h} className="px-4 py-3 text-left font-medium text-gray-600">{h}</th>)}</tr></thead>
          <tbody className="divide-y">
            {isLoading && <tr><td colSpan={6} className="text-center py-10 text-gray-400">Đang tải...</td></tr>}
            {data?.data?.map((c: any) => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{c.name}</td>
                <td className="px-4 py-3 text-gray-500">{c.phone || '-'}</td>
                <td className="px-4 py-3"><span className="flex items-center gap-1"><Star size={14} className="text-yellow-400" />{c.points}</span></td>
                <td className="px-4 py-3 text-green-600 font-medium">{fmt(c.totalSpent)}</td>
                <td className="px-4 py-3"><span className={c.debt > 0 ? 'badge badge-red' : 'text-gray-400'}>{c.debt > 0 ? fmt(c.debt) : '-'}</span></td>
                <td className="px-4 py-3">
                  <button onClick={() => { setEditing(c); setForm({ name: c.name, phone: c.phone || '', email: c.email || '', address: c.address || '' }); setShowForm(true) }} className="text-blue-500 hover:text-blue-700"><Edit2 size={15} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-4 py-3 border-t text-sm text-gray-500">Tổng: {data?.total || 0} khách hàng</div>
      </div>

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

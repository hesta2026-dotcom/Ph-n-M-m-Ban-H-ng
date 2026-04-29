import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../../services/api'
import toast from 'react-hot-toast'
import { Plus, TrendingUp, TrendingDown } from 'lucide-react'

const fmt = (n: number) => new Intl.NumberFormat('vi-VN').format(n) + 'đ'

export default function Expenses() {
  const [type, setType] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ type: 'EXPENSE', category: '', amount: 0, description: '' })
  const qc = useQueryClient()

  const { data } = useQuery({
    queryKey: ['expenses', type],
    queryFn: () => api.get(`/expenses?type=${type}&limit=50`).then(r => r.data)
  })

  const { data: cashflow } = useQuery({
    queryKey: ['cashflow'],
    queryFn: () => api.get('/reports/cashflow').then(r => r.data)
  })

  const save = useMutation({
    mutationFn: (d: any) => api.post('/expenses', d),
    onSuccess: () => { toast.success('Đã ghi nhận'); qc.invalidateQueries({ queryKey: ['expenses'] }); qc.invalidateQueries({ queryKey: ['cashflow'] }); setShowForm(false); setForm({ type: 'EXPENSE', category: '', amount: 0, description: '' }) },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Lỗi')
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Thu chi</h1>
        <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2"><Plus size={18} /> Ghi nhận thu/chi</button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Tổng thu', value: cashflow?.income || 0, icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Tổng chi', value: cashflow?.expense || 0, icon: TrendingDown, color: 'text-red-600', bg: 'bg-red-50' },
          { label: 'Còn lại', value: cashflow?.net || 0, icon: TrendingUp, color: cashflow?.net >= 0 ? 'text-blue-600' : 'text-red-600', bg: 'bg-blue-50' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className={`card flex items-center gap-4`}>
            <div className={`${bg} p-3 rounded-xl`}><Icon size={24} className={color} /></div>
            <div><p className={`text-2xl font-bold ${color}`}>{fmt(value)}</p><p className="text-sm text-gray-500">{label}</p></div>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        {[['', 'Tất cả'], ['INCOME', 'Thu'], ['EXPENSE', 'Chi']].map(([val, label]) => (
          <button key={val} onClick={() => setType(val)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${type === val ? 'bg-blue-600 text-white' : 'bg-white border hover:bg-gray-50'}`}>{label}</button>
        ))}
      </div>

      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b"><tr>{['Loại', 'Danh mục', 'Số tiền', 'Mô tả', 'Người tạo', 'Ngày'].map(h => <th key={h} className="px-4 py-3 text-left font-medium text-gray-600">{h}</th>)}</tr></thead>
          <tbody className="divide-y">
            {data?.data?.map((e: any) => (
              <tr key={e.id} className="hover:bg-gray-50">
                <td className="px-4 py-3"><span className={`badge ${e.type === 'INCOME' ? 'badge-green' : 'badge-red'}`}>{e.type === 'INCOME' ? 'Thu' : 'Chi'}</span></td>
                <td className="px-4 py-3">{e.category}</td>
                <td className={`px-4 py-3 font-semibold ${e.type === 'INCOME' ? 'text-green-600' : 'text-red-600'}`}>{fmt(e.amount)}</td>
                <td className="px-4 py-3 text-gray-500">{e.description || '-'}</td>
                <td className="px-4 py-3 text-gray-500">{e.user?.name}</td>
                <td className="px-4 py-3 text-gray-400">{new Date(e.createdAt).toLocaleDateString('vi-VN')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold mb-4">Ghi nhận thu/chi</h2>
            <form onSubmit={e => { e.preventDefault(); save.mutate(form) }} className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Loại *</label>
                <select className="input" value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}>
                  <option value="INCOME">Thu tiền</option>
                  <option value="EXPENSE">Chi tiền</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Danh mục *</label>
                <input className="input" placeholder="VD: Lương, Điện nước, Nhập hàng..." value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Số tiền *</label>
                <input className="input" type="number" min="1" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: +e.target.value }))} required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Mô tả</label>
                <textarea className="input" rows={2} value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
              </div>
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

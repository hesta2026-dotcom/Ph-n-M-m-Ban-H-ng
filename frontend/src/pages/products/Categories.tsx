import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../../services/api'
import toast from 'react-hot-toast'
import { Plus, Edit2, Trash2 } from 'lucide-react'

export default function Categories() {
  const [form, setForm] = useState({ name: '', parentId: '' })
  const [editing, setEditing] = useState<any>(null)
  const [showForm, setShowForm] = useState(false)
  const qc = useQueryClient()

  const { data: categories } = useQuery({ queryKey: ['categories'], queryFn: () => api.get('/categories').then(r => r.data) })

  const save = useMutation({
    mutationFn: (d: any) => editing ? api.put(`/categories/${editing.id}`, d) : api.post('/categories', d),
    onSuccess: () => { toast.success('Đã lưu'); qc.invalidateQueries({ queryKey: ['categories'] }); setShowForm(false); setEditing(null); setForm({ name: '', parentId: '' }) },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Lỗi')
  })

  const del = useMutation({
    mutationFn: (id: string) => api.delete(`/categories/${id}`),
    onSuccess: () => { toast.success('Đã xóa'); qc.invalidateQueries({ queryKey: ['categories'] }) },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Không thể xóa')
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Danh mục sản phẩm</h1>
        <button onClick={() => { setEditing(null); setForm({ name: '', parentId: '' }); setShowForm(true) }} className="btn-primary flex items-center gap-2"><Plus size={18} /> Thêm danh mục</button>
      </div>
      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b"><tr>{['Tên danh mục', 'Danh mục cha', 'Số SP', 'Thao tác'].map(h => <th key={h} className="px-4 py-3 text-left font-medium text-gray-600">{h}</th>)}</tr></thead>
          <tbody className="divide-y">
            {categories?.map((c: any) => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{c.name}</td>
                <td className="px-4 py-3 text-gray-500">-</td>
                <td className="px-4 py-3"><span className="badge badge-blue">{c._count?.products || 0}</span></td>
                <td className="px-4 py-3 flex gap-2">
                  <button onClick={() => { setEditing(c); setForm({ name: c.name, parentId: c.parentId || '' }); setShowForm(true) }} className="text-blue-500 hover:text-blue-700"><Edit2 size={15} /></button>
                  <button onClick={() => { if (confirm('Xóa danh mục này?')) del.mutate(c.id) }} className="text-red-400 hover:text-red-600"><Trash2 size={15} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold mb-4">{editing ? 'Sửa danh mục' : 'Thêm danh mục'}</h2>
            <form onSubmit={e => { e.preventDefault(); save.mutate(form) }} className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Tên danh mục *</label>
                <input className="input" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Danh mục cha</label>
                <select className="input" value={form.parentId} onChange={e => setForm(p => ({ ...p, parentId: e.target.value }))}>
                  <option value="">-- Không có --</option>
                  {categories?.filter((c: any) => c.id !== editing?.id).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
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

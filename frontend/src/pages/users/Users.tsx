import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../../services/api'
import toast from 'react-hot-toast'
import { Plus, Edit2, Trash2 } from 'lucide-react'

const roleLabel: any = { ADMIN: 'Quản trị', MANAGER: 'Quản lý', STAFF: 'Nhân viên', CASHIER: 'Thu ngân' }
const roleClass: any = { ADMIN: 'badge-red', MANAGER: 'badge-blue', STAFF: 'badge-green', CASHIER: 'badge-yellow' }
const emptyForm = { name: '', email: '', password: '', role: 'STAFF', phone: '' }

export default function Users() {
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form, setForm] = useState(emptyForm)
  const qc = useQueryClient()

  const { data } = useQuery({ queryKey: ['users'], queryFn: () => api.get('/users').then(r => r.data) })

  const save = useMutation({
    mutationFn: (d: any) => editing ? api.put(`/users/${editing.id}`, d) : api.post('/auth/register', d),
    onSuccess: () => { toast.success('Đã lưu'); qc.invalidateQueries({ queryKey: ['users'] }); setShowForm(false); setEditing(null); setForm(emptyForm) },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Lỗi')
  })

  const del = useMutation({
    mutationFn: (id: string) => api.delete(`/users/${id}`),
    onSuccess: () => { toast.success('Đã xóa nhân viên'); qc.invalidateQueries({ queryKey: ['users'] }) },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Không thể xóa')
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Quản lý nhân viên</h1>
        <button onClick={() => { setEditing(null); setForm(emptyForm); setShowForm(true) }} className="btn-primary flex items-center gap-2"><Plus size={18} /> Thêm nhân viên</button>
      </div>
      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b"><tr>{['Tên', 'Email', 'SĐT', 'Vai trò', 'Trạng thái', 'Thao tác'].map(h => <th key={h} className="px-4 py-3 text-left font-medium text-gray-600">{h}</th>)}</tr></thead>
          <tbody className="divide-y">
            {data?.map((u: any) => (
              <tr key={u.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{u.name}</td>
                <td className="px-4 py-3 text-gray-500">{u.email}</td>
                <td className="px-4 py-3 text-gray-500">{u.phone || '-'}</td>
                <td className="px-4 py-3"><span className={`badge ${roleClass[u.role]}`}>{roleLabel[u.role]}</span></td>
                <td className="px-4 py-3"><span className={`badge ${u.isActive ? 'badge-green' : 'badge-red'}`}>{u.isActive ? 'Đang hoạt động' : 'Đã khóa'}</span></td>
                <td className="px-4 py-3"><button onClick={() => { setEditing(u); setForm({ name: u.name, email: u.email, password: '', role: u.role, phone: u.phone || '' }); setShowForm(true) }} className="text-blue-500 hover:text-blue-700"><Edit2 size={15} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold mb-4">{editing ? 'Sửa nhân viên' : 'Thêm nhân viên mới'}</h2>
            <form onSubmit={e => { e.preventDefault(); save.mutate(form) }} className="space-y-3">
              {[['Họ tên *', 'name', 'text'], ['Email *', 'email', 'email'], ['Mật khẩu' + (editing ? '' : ' *'), 'password', 'password'], ['SĐT', 'phone', 'text']].map(([label, key, type]) => (
                <div key={key}><label className="block text-sm font-medium mb-1">{label}</label><input className="input" type={type} value={(form as any)[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} required={label.includes('*')} /></div>
              ))}
              <div><label className="block text-sm font-medium mb-1">Vai trò</label>
                <select className="input" value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))}>
                  {Object.entries(roleLabel).map(([val, label]) => <option key={val} value={val}>{label as string}</option>)}
                </select>
              </div>
              <div className="flex gap-3 justify-end pt-2"><button type="button" onClick={() => setShowForm(false)} className="btn-outline">Hủy</button><button type="submit" disabled={save.isPending} className="btn-primary">{save.isPending ? 'Đang lưu...' : 'Lưu'}</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../../services/api'
import toast from 'react-hot-toast'
import { Plus, Search, Edit2 } from 'lucide-react'

const fmt = (n: number) => new Intl.NumberFormat('vi-VN').format(n) + 'đ'
const emptyForm = { name: '', phone: '', email: '', address: '', taxCode: '' }

export default function Suppliers() {
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form, setForm] = useState(emptyForm)
  const qc = useQueryClient()

  const { data } = useQuery({ queryKey: ['suppliers', search], queryFn: () => api.get(`/suppliers?search=${search}`).then(r => r.data) })

  const save = useMutation({
    mutationFn: (d: any) => editing ? api.put(`/suppliers/${editing.id}`, d) : api.post('/suppliers', d),
    onSuccess: () => { toast.success('Đã lưu'); qc.invalidateQueries({ queryKey: ['suppliers'] }); setShowForm(false); setEditing(null); setForm(emptyForm) },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Lỗi')
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Nhà cung cấp</h1>
        <button onClick={() => { setEditing(null); setForm(emptyForm); setShowForm(true) }} className="btn-primary flex items-center gap-2"><Plus size={18} /> Thêm NCC</button>
      </div>
      <div className="relative"><Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><input className="input pl-10" placeholder="Tìm theo tên, SĐT..." value={search} onChange={e => setSearch(e.target.value)} /></div>
      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b"><tr>{['Tên NCC', 'SĐT', 'Email', 'Mã số thuế', 'Công nợ', 'Thao tác'].map(h => <th key={h} className="px-4 py-3 text-left font-medium text-gray-600">{h}</th>)}</tr></thead>
          <tbody className="divide-y">
            {data?.map((s: any) => (
              <tr key={s.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{s.name}</td>
                <td className="px-4 py-3 text-gray-500">{s.phone || '-'}</td>
                <td className="px-4 py-3 text-gray-500">{s.email || '-'}</td>
                <td className="px-4 py-3 text-gray-500">{s.taxCode || '-'}</td>
                <td className="px-4 py-3"><span className={s.debt > 0 ? 'badge badge-red' : 'text-gray-400'}>{s.debt > 0 ? fmt(s.debt) : '-'}</span></td>
                <td className="px-4 py-3"><button onClick={() => { setEditing(s); setForm({ name: s.name, phone: s.phone || '', email: s.email || '', address: s.address || '', taxCode: s.taxCode || '' }); setShowForm(true) }} className="text-blue-500 hover:text-blue-700"><Edit2 size={15} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold mb-4">{editing ? 'Sửa NCC' : 'Thêm nhà cung cấp'}</h2>
            <form onSubmit={e => { e.preventDefault(); save.mutate(form) }} className="space-y-3">
              {[['Tên NCC *', 'name'], ['SĐT', 'phone'], ['Email', 'email'], ['Địa chỉ', 'address'], ['Mã số thuế', 'taxCode']].map(([label, key]) => (
                <div key={key}><label className="block text-sm font-medium mb-1">{label}</label><input className="input" value={(form as any)[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} required={label.includes('*')} /></div>
              ))}
              <div className="flex gap-3 justify-end pt-2"><button type="button" onClick={() => setShowForm(false)} className="btn-outline">Hủy</button><button type="submit" disabled={save.isPending} className="btn-primary">{save.isPending ? 'Đang lưu...' : 'Lưu'}</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

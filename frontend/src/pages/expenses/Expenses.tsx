import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../../services/api'
import toast from 'react-hot-toast'
import { Plus, TrendingUp, TrendingDown, FileSpreadsheet, FileText } from 'lucide-react'
import { exportExcel, exportPDF, PRESETS, fmtPeriod } from '../../utils/export'
import ColumnPicker, { ColDef } from '../../components/ColumnPicker'

const fmt = (n: number) => new Intl.NumberFormat('vi-VN').format(n) + 'đ'

const COLS: ColDef[] = [
  { key: 'type', label: 'Loại' },
  { key: 'category', label: 'Danh mục' },
  { key: 'amount', label: 'Số tiền' },
  { key: 'description', label: 'Mô tả' },
  { key: 'user', label: 'Người tạo' },
  { key: 'createdAt', label: 'Ngày' },
]

export default function Expenses() {
  const [type, setType] = useState('')
  const _now = new Date()
  const _ld = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const [from, setFrom] = useState(_ld(new Date(_now.getFullYear(), _now.getMonth(), 1)))
  const [to, setTo] = useState(_ld(_now))
  const [activePreset, setActivePreset] = useState('Tháng này')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ type: 'EXPENSE', category: '', amount: 0, description: '' })
  const [visible, setVisible] = useState<Set<string>>(() => new Set(COLS.map(c => c.key)))
  const qc = useQueryClient()

  const applyPreset = (p: typeof PRESETS[number]) => {
    const [f, t] = p.getDates(); setFrom(f); setTo(t); setActivePreset(p.label)
  }

  const { data } = useQuery({
    queryKey: ['expenses', type, from, to],
    queryFn: () => api.get(`/expenses?type=${type}&from=${from}&to=${to}&limit=200`).then(r => r.data)
  })

  const { data: cashflow } = useQuery({
    queryKey: ['cashflow', from, to],
    queryFn: () => api.get(`/reports/cashflow?from=${from}&to=${to}`).then(r => r.data)
  })

  const save = useMutation({
    mutationFn: (d: any) => api.post('/expenses', d),
    onSuccess: () => {
      toast.success('Đã ghi nhận')
      qc.invalidateQueries({ queryKey: ['expenses'] })
      qc.invalidateQueries({ queryKey: ['cashflow'] })
      setShowForm(false)
      setForm({ type: 'EXPENSE', category: '', amount: 0, description: '' })
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Lỗi')
  })

  const getVal = (e: any, key: string) => {
    switch (key) {
      case 'type': return e.type === 'INCOME' ? 'Thu' : 'Chi'
      case 'category': return e.category
      case 'amount': return e.amount
      case 'description': return e.description || ''
      case 'user': return e.user?.name || ''
      case 'createdAt': return new Date(e.createdAt).toLocaleDateString('vi-VN')
      default: return ''
    }
  }

  const visCols = COLS.filter(c => visible.has(c.key))

  const handleExcel = () => {
    const headers = visCols.map(c => c.label)
    const rows = (data?.data || []).map((e: any) => visCols.map(c => getVal(e, c.key)))
    exportExcel(`Thu-chi_${from}_${to}`, 'Thu chi', headers, rows)
  }

  const handlePDF = () => {
    const headers = visCols.map(c => c.label)
    const rows = (data?.data || []).map((e: any) => visCols.map(c =>
      c.key === 'amount' ? fmt(e.amount) : getVal(e, c.key)
    ))
    exportPDF(`Thu-chi_${from}_${to}`, 'Báo cáo thu chi', fmtPeriod(from, to), headers, rows)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Thu chi</h1>
        <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2"><Plus size={18} /> Ghi nhận thu/chi</button>
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
            <input type="date" className="input text-sm py-1.5" value={from} onChange={e => { setFrom(e.target.value); setActivePreset('') }} />
            <span className="text-sm text-gray-500">Đến:</span>
            <input type="date" className="input text-sm py-1.5" value={to} onChange={e => { setTo(e.target.value); setActivePreset('') }} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Tổng thu', value: cashflow?.income || 0, icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Tổng chi', value: cashflow?.expense || 0, icon: TrendingDown, color: 'text-red-600', bg: 'bg-red-50' },
          { label: 'Còn lại', value: cashflow?.net || 0, icon: TrendingUp, color: (cashflow?.net || 0) >= 0 ? 'text-blue-600' : 'text-red-600', bg: 'bg-blue-50' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="card flex items-center gap-4">
            <div className={`${bg} p-3 rounded-xl`}><Icon size={24} className={color} /></div>
            <div><p className={`text-2xl font-bold ${color}`}>{fmt(value)}</p><p className="text-sm text-gray-500">{label}</p></div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-2">
          {[['', 'Tất cả'], ['INCOME', 'Thu'], ['EXPENSE', 'Chi']].map(([val, label]) => (
            <button key={val} onClick={() => setType(val)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${type === val ? 'bg-blue-600 text-white' : 'bg-white border hover:bg-gray-50'}`}>{label}</button>
          ))}
        </div>
        <div className="flex gap-2 items-center">
          <ColumnPicker cols={COLS} visible={visible} onChange={setVisible} />
          <button onClick={handleExcel} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700">
            <FileSpreadsheet size={15} /> Excel
          </button>
          <button onClick={handlePDF} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700">
            <FileText size={15} /> PDF
          </button>
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              {visCols.map(c => <th key={c.key} className="px-4 py-3 text-left font-medium text-gray-600">{c.label}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y">
            {data?.data?.map((e: any) => (
              <tr key={e.id} className="hover:bg-gray-50">
                {visible.has('type') && <td className="px-4 py-3"><span className={`badge ${e.type === 'INCOME' ? 'badge-green' : 'badge-red'}`}>{e.type === 'INCOME' ? 'Thu' : 'Chi'}</span></td>}
                {visible.has('category') && <td className="px-4 py-3">{e.category}</td>}
                {visible.has('amount') && <td className={`px-4 py-3 font-semibold ${e.type === 'INCOME' ? 'text-green-600' : 'text-red-600'}`}>{fmt(e.amount)}</td>}
                {visible.has('description') && <td className="px-4 py-3 text-gray-500">{e.description || '-'}</td>}
                {visible.has('user') && <td className="px-4 py-3 text-gray-500">{e.user?.name}</td>}
                {visible.has('createdAt') && <td className="px-4 py-3 text-gray-400">{new Date(e.createdAt).toLocaleDateString('vi-VN')}</td>}
              </tr>
            ))}
            {!data?.data?.length && <tr><td colSpan={visCols.length} className="text-center py-10 text-gray-400">Không có dữ liệu</td></tr>}
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

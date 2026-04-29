import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../../services/api'
import toast from 'react-hot-toast'
import { CreditCard, CheckCircle } from 'lucide-react'

const fmt = (n: number) => new Intl.NumberFormat('vi-VN').format(n) + 'đ'

export default function Debts() {
  const [type, setType] = useState('CUSTOMER')
  const [status, setStatus] = useState('UNPAID')
  const [payAmount, setPayAmount] = useState<{ [id: string]: number }>({})
  const qc = useQueryClient()

  const { data } = useQuery({
    queryKey: ['debts', type, status],
    queryFn: () => api.get(`/debts?type=${type}&status=${status}&limit=50`).then(r => r.data)
  })

  const pay = useMutation({
    mutationFn: ({ id, amount }: { id: string; amount: number }) => api.post(`/debts/${id}/pay`, { amount }),
    onSuccess: () => { toast.success('Đã thu tiền'); qc.invalidateQueries({ queryKey: ['debts'] }) },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Lỗi')
  })

  const statusLabel: any = { UNPAID: 'Chưa trả', PARTIAL: 'Trả 1 phần', PAID: 'Đã trả' }
  const statusClass: any = { UNPAID: 'badge-red', PARTIAL: 'badge-yellow', PAID: 'badge-green' }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Công nợ</h1>
      <div className="flex gap-2 flex-wrap">
        {[['CUSTOMER', 'Nợ khách hàng'], ['SUPPLIER', 'Nợ nhà cung cấp']].map(([val, label]) => (
          <button key={val} onClick={() => setType(val)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${type === val ? 'bg-blue-600 text-white' : 'bg-white border hover:bg-gray-50'}`}>{label}</button>
        ))}
        <div className="ml-auto flex gap-2">
          {[['UNPAID', 'Chưa trả'], ['PARTIAL', 'Trả 1 phần'], ['PAID', 'Đã trả'], ['', 'Tất cả']].map(([val, label]) => (
            <button key={val} onClick={() => setStatus(val)} className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${status === val ? 'bg-gray-800 text-white' : 'bg-white border hover:bg-gray-50'}`}>{label}</button>
          ))}
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b"><tr>{[type === 'CUSTOMER' ? 'Khách hàng' : 'Nhà cung cấp', 'Tổng nợ', 'Đã trả', 'Còn lại', 'Trạng thái', 'Ngày tạo', 'Thu tiền'].map(h => <th key={h} className="px-4 py-3 text-left font-medium text-gray-600">{h}</th>)}</tr></thead>
          <tbody className="divide-y">
            {data?.data?.map((d: any) => (
              <tr key={d.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{d.customer?.name || d.supplier?.name || '-'}</td>
                <td className="px-4 py-3">{fmt(d.amount)}</td>
                <td className="px-4 py-3 text-green-600">{fmt(d.paid)}</td>
                <td className="px-4 py-3 text-red-600 font-semibold">{fmt(d.remaining)}</td>
                <td className="px-4 py-3"><span className={`badge ${statusClass[d.status]}`}>{statusLabel[d.status]}</span></td>
                <td className="px-4 py-3 text-gray-400">{new Date(d.createdAt).toLocaleDateString('vi-VN')}</td>
                <td className="px-4 py-3">
                  {d.status !== 'PAID' && (
                    <div className="flex items-center gap-2">
                      <input type="number" className="border rounded px-2 py-1 w-28 text-sm" placeholder="Số tiền" value={payAmount[d.id] || ''} onChange={e => setPayAmount(p => ({ ...p, [d.id]: +e.target.value }))} />
                      <button onClick={() => pay.mutate({ id: d.id, amount: payAmount[d.id] })} disabled={!payAmount[d.id]} className="text-green-600 hover:text-green-800 disabled:opacity-40"><CheckCircle size={20} /></button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {!data?.data?.length && <tr><td colSpan={7} className="text-center py-10 text-gray-400">Không có công nợ</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

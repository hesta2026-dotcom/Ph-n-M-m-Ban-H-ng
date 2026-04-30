import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../../services/api'
import toast from 'react-hot-toast'
import { CheckCircle, TrendingDown, TrendingUp } from 'lucide-react'

const fmt = (n: number) => new Intl.NumberFormat('vi-VN').format(n) + 'đ'
const fmtMoney = (n: number) => n === 0 ? '' : n.toLocaleString('vi-VN')
const parseMoney = (s: string) => +s.replace(/[^0-9]/g, '') || 0

export default function Debts() {
  const [type, setType] = useState('SUPPLIER')
  const [status, setStatus] = useState('UNPAID')
  const [payAmount, setPayAmount] = useState<{ [id: string]: number }>({})
  const qc = useQueryClient()

  const { data } = useQuery({
    queryKey: ['debts', type, status],
    queryFn: () => api.get(`/debts?type=${type}&status=${status}&limit=50`).then(r => r.data)
  })

  const { data: summary } = useQuery({
    queryKey: ['debts-summary'],
    queryFn: async () => {
      const [sup, cus] = await Promise.all([
        api.get('/debts?type=SUPPLIER&status=UNPAID&limit=100').then(r => r.data),
        api.get('/debts?type=SUPPLIER&status=PARTIAL&limit=100').then(r => r.data),
      ])
      const supAll = [...(sup.data ?? []), ...(cus.data ?? [])]
      return {
        supplierDebt: supAll.reduce((s: number, d: any) => s + d.remaining, 0),
        supplierCount: supAll.length,
      }
    }
  })

  const pay = useMutation({
    mutationFn: ({ id, amount }: { id: string; amount: number }) => api.post(`/debts/${id}/pay`, { amount }),
    onSuccess: () => {
      toast.success('Đã thanh toán')
      qc.invalidateQueries({ queryKey: ['debts'] })
      qc.invalidateQueries({ queryKey: ['debts-summary'] })
      qc.invalidateQueries({ queryKey: ['suppliers'] })
      setPayAmount({})
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Lỗi')
  })

  const statusLabel = (d: any) => {
    if (d.status === 'PAID') return 'Đã trả'
    if (d.status === 'PARTIAL') return 'Trả 1 phần'
    return d.type === 'SUPPLIER' ? 'Phải trả' : 'Chưa trả'
  }
  const statusClass: any = { UNPAID: 'badge-red', PARTIAL: 'badge-yellow', PAID: 'badge-green' }

  const colHeader = type === 'CUSTOMER' ? 'Khách hàng' : 'Nhà cung cấp'
  const payBtnLabel = type === 'SUPPLIER' ? 'Thanh toán NCC' : 'Thu tiền KH'

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Công nợ</h1>

      {/* Tổng quan */}
      <div className="grid grid-cols-2 gap-4">
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <TrendingDown size={20} className="text-red-600" />
          </div>
          <div>
            <p className="text-xs text-gray-500">Phải trả NCC</p>
            <p className="text-lg font-bold text-red-600">{fmt(summary?.supplierDebt ?? 0)}</p>
            <p className="text-xs text-gray-400">{summary?.supplierCount ?? 0} phiếu chưa thanh toán</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <TrendingUp size={20} className="text-blue-600" />
          </div>
          <div>
            <p className="text-xs text-gray-500">Khách nợ mình</p>
            <p className="text-lg font-bold text-blue-600">—</p>
            <p className="text-xs text-gray-400">Chuyển sang tab Nợ khách hàng</p>
          </div>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {[['SUPPLIER', 'Nợ nhà cung cấp'], ['CUSTOMER', 'Nợ khách hàng']].map(([val, label]) => (
          <button key={val} onClick={() => setType(val)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${type === val ? 'bg-blue-600 text-white' : 'bg-white border hover:bg-gray-50'}`}>
            {label}
          </button>
        ))}
        <div className="ml-auto flex gap-2">
          {[['UNPAID', type === 'SUPPLIER' ? 'Phải trả' : 'Chưa trả'], ['PARTIAL', 'Trả 1 phần'], ['PAID', 'Đã trả'], ['', 'Tất cả']].map(([val, label]) => (
            <button key={val} onClick={() => setStatus(val)}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${status === val ? 'bg-gray-800 text-white' : 'bg-white border hover:bg-gray-50'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              {[colHeader, 'Diễn giải', 'Tổng nợ', 'Đã thanh toán', 'Còn lại', 'Trạng thái', 'Ngày tạo', 'Thanh toán'].map(h => (
                <th key={h} className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {data?.data?.map((d: any) => (
              <tr key={d.id} className={`hover:bg-gray-50 ${d.status === 'UNPAID' ? 'bg-red-50/30' : ''}`}>
                <td className="px-4 py-3 font-medium">{d.customer?.name || d.supplier?.name || '-'}</td>
                <td className="px-4 py-3 text-gray-400 text-xs max-w-[160px] truncate">{d.note || '-'}</td>
                <td className="px-4 py-3 whitespace-nowrap">{fmt(d.amount)}</td>
                <td className="px-4 py-3 text-green-600 whitespace-nowrap">{fmt(d.paid)}</td>
                <td className="px-4 py-3 text-red-600 font-bold whitespace-nowrap">{fmt(d.remaining)}</td>
                <td className="px-4 py-3">
                  <span className={`badge ${statusClass[d.status]}`}>{statusLabel(d)}</span>
                </td>
                <td className="px-4 py-3 text-gray-400 whitespace-nowrap text-xs">{new Date(d.createdAt).toLocaleDateString('vi-VN')}</td>
                <td className="px-4 py-3">
                  {d.status !== 'PAID' && (
                    <div className="flex items-center gap-1.5">
                      <div className="relative">
                        <input
                          className="border rounded px-2 py-1 w-28 text-sm text-right pr-5"
                          placeholder="0"
                          value={fmtMoney(payAmount[d.id] || 0)}
                          onChange={e => setPayAmount(p => ({ ...p, [d.id]: parseMoney(e.target.value) }))}
                        />
                        <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">đ</span>
                      </div>
                      <button
                        onClick={() => pay.mutate({ id: d.id, amount: payAmount[d.id] })}
                        disabled={!payAmount[d.id] || pay.isPending}
                        title={payBtnLabel}
                        className="text-green-600 hover:text-green-800 disabled:opacity-40">
                        <CheckCircle size={20} />
                      </button>
                    </div>
                  )}
                  {d.status === 'PAID' && (
                    <span className="text-green-500 text-xs flex items-center gap-1"><CheckCircle size={14} /> Hoàn tất</span>
                  )}
                </td>
              </tr>
            ))}
            {!data?.data?.length && (
              <tr><td colSpan={8} className="text-center py-10 text-gray-400">
                {status === 'UNPAID' ? 'Không có công nợ cần thanh toán' : 'Không có dữ liệu'}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

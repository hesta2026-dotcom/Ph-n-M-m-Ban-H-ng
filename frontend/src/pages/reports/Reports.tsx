import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '../../services/api'
import { BarChart2, TrendingUp, Package, Users } from 'lucide-react'

const fmt = (n: number) => new Intl.NumberFormat('vi-VN').format(n) + 'đ'

export default function Reports() {
  const [from, setFrom] = useState(new Date(new Date().setDate(1)).toISOString().slice(0, 10))
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10))

  const { data: revenue } = useQuery({
    queryKey: ['revenue', from, to],
    queryFn: () => api.get(`/reports/revenue?from=${from}&to=${to}`).then(r => r.data)
  })

  const { data: topProducts } = useQuery({
    queryKey: ['top-products', from, to],
    queryFn: () => api.get(`/reports/top-products?from=${from}&to=${to}&limit=10`).then(r => r.data)
  })

  const { data: cashflow } = useQuery({
    queryKey: ['cashflow-report', from, to],
    queryFn: () => api.get(`/reports/cashflow?from=${from}&to=${to}`).then(r => r.data)
  })

  const totalRevenue = revenue?.reduce((s: number, o: any) => s + o.total, 0) || 0
  const totalOrders = revenue?.length || 0

  const byChannel = revenue?.reduce((acc: any, o: any) => { acc[o.channel] = (acc[o.channel] || 0) + o.total; return acc }, {}) || {}

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold">Báo cáo</h1>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">Từ:</span>
          <input type="date" className="input text-sm py-1.5" value={from} onChange={e => setFrom(e.target.value)} />
          <span className="text-sm text-gray-500">Đến:</span>
          <input type="date" className="input text-sm py-1.5" value={to} onChange={e => setTo(e.target.value)} />
        </div>
      </div>

      {/* Tổng quan */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Doanh thu', value: fmt(totalRevenue), icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Số đơn hàng', value: totalOrders, icon: BarChart2, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Tổng thu', value: fmt(cashflow?.income || 0), icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Tổng chi', value: fmt(cashflow?.expense || 0), icon: TrendingUp, color: 'text-red-600', bg: 'bg-red-50' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="card flex items-center gap-3">
            <div className={`${bg} p-3 rounded-xl`}><Icon size={22} className={color} /></div>
            <div><p className={`text-xl font-bold ${color}`}>{value}</p><p className="text-xs text-gray-500">{label}</p></div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Doanh thu theo kênh */}
        <div className="card">
          <h2 className="font-semibold mb-4 flex items-center gap-2"><BarChart2 size={18} /> Doanh thu theo kênh</h2>
          <div className="space-y-3">
            {Object.entries(byChannel).map(([channel, amount]: any) => {
              const pct = totalRevenue ? (amount / totalRevenue * 100).toFixed(1) : 0
              const channelLabel: any = { store: 'Cửa hàng', shopee: 'Shopee', facebook: 'Facebook', web: 'Website' }
              return (
                <div key={channel}>
                  <div className="flex justify-between text-sm mb-1"><span className="font-medium">{channelLabel[channel] || channel}</span><span className="text-gray-500">{fmt(amount)} ({pct}%)</span></div>
                  <div className="h-2 bg-gray-100 rounded-full"><div className="h-2 bg-blue-500 rounded-full" style={{ width: `${pct}%` }} /></div>
                </div>
              )
            })}
            {!Object.keys(byChannel).length && <p className="text-gray-400 text-sm">Không có dữ liệu</p>}
          </div>
        </div>

        {/* Top sản phẩm bán chạy */}
        <div className="card">
          <h2 className="font-semibold mb-4 flex items-center gap-2"><Package size={18} /> Top sản phẩm bán chạy</h2>
          <div className="space-y-2">
            {topProducts?.map((item: any, idx: number) => (
              <div key={item.productId} className="flex items-center gap-3 text-sm">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${idx < 3 ? 'bg-yellow-400 text-yellow-900' : 'bg-gray-100 text-gray-600'}`}>{idx + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{item.product?.name}</p>
                  <p className="text-gray-400">SL: {item._sum.qty} | {fmt(item._sum.total || 0)}</p>
                </div>
              </div>
            ))}
            {!topProducts?.length && <p className="text-gray-400 text-sm">Không có dữ liệu</p>}
          </div>
        </div>
      </div>
    </div>
  )
}

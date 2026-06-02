import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '../../services/api'
import { ShoppingCart, Package, Users, AlertTriangle, TrendingUp } from 'lucide-react'
import { format, startOfMonth, endOfMonth, subMonths, subDays } from 'date-fns'
import { vi } from 'date-fns/locale'

const fmt = (n: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n)
const toStr = (d: Date) => format(d, 'yyyy-MM-dd')

const PRESETS = [
  { label: 'Hôm nay',      from: () => toStr(new Date()),                     to: () => toStr(new Date()) },
  { label: 'Hôm qua',      from: () => toStr(subDays(new Date(), 1)),          to: () => toStr(subDays(new Date(), 1)) },
  { label: '7 ngày',       from: () => toStr(subDays(new Date(), 6)),          to: () => toStr(new Date()) },
  { label: 'Tháng này',    from: () => toStr(startOfMonth(new Date())),        to: () => toStr(new Date()) },
  { label: 'Tháng trước',  from: () => toStr(startOfMonth(subMonths(new Date(), 1))), to: () => toStr(endOfMonth(subMonths(new Date(), 1))) },
]

export default function Dashboard() {
  const [preset, setPreset] = useState('Hôm nay')
  const [from, setFrom] = useState(toStr(new Date()))
  const [to, setTo] = useState(toStr(new Date()))

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', from, to],
    queryFn: () => api.get(`/reports/dashboard?from=${from}&to=${to}`).then(r => r.data)
  })

  const applyPreset = (p: typeof PRESETS[0]) => {
    setPreset(p.label)
    setFrom(p.from())
    setTo(p.to())
  }

  const handleFromChange = (val: string) => { setFrom(val); setPreset('') }
  const handleToChange   = (val: string) => { setTo(val);   setPreset('') }

  if (isLoading) return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" /></div>

  const periodLabel = preset || `${from} – ${to}`

  const stats = [
    { label: `Doanh thu (${periodLabel})`, value: fmt(data?.periodRevenue || 0), icon: TrendingUp, iconColor: 'text-green-600', bg: 'bg-green-50' },
    { label: `Đơn hàng (${periodLabel})`,  value: data?.periodOrders || 0,        icon: ShoppingCart, iconColor: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Tổng sản phẩm',             value: data?.totalProducts || 0,        icon: Package,      iconColor: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'Tổng khách hàng',           value: data?.totalCustomers || 0,       icon: Users,        iconColor: 'text-orange-600', bg: 'bg-orange-50' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-gray-900">Tổng quan</h1>
        <p className="text-gray-500 text-sm">{format(new Date(), 'EEEE, dd/MM/yyyy', { locale: vi })}</p>
      </div>

      {/* Thanh chọn ngày */}
      <div className="flex flex-col gap-2">
        {/* Preset buttons — cuộn ngang trên mobile */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
          {PRESETS.map(p => (
            <button key={p.label} onClick={() => applyPreset(p)}
              className={`flex-shrink-0 px-3 py-2 rounded-lg text-sm font-medium transition-colors border ${preset === p.label ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
              {p.label}
            </button>
          ))}
        </div>
        {/* Custom date inputs */}
        <div className="flex items-center gap-2 text-sm">
          <input type="date" value={from} onChange={e => handleFromChange(e.target.value)}
            className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
          <span className="text-gray-400 flex-shrink-0">–</span>
          <input type="date" value={to} onChange={e => handleToChange(e.target.value)}
            className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
        </div>
      </div>

      {/* Stats — 2 cột trên mobile */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map(({ label, value, icon: Icon, iconColor, bg }) => (
          <div key={label} className="card p-4 flex flex-col gap-2">
            <div className={`${bg} p-2.5 rounded-xl w-fit`}>
              <Icon className={iconColor} size={20} />
            </div>
            <div>
              <p className="text-xl font-bold text-gray-900">{value}</p>
              <p className="text-xs text-gray-500 leading-tight mt-0.5">{label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cảnh báo tồn kho */}
        {data?.lowStock > 0 && (
          <div className="card border-l-4 border-yellow-400">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle size={20} className="text-yellow-500" />
              <h2 className="font-semibold">Cảnh báo tồn kho thấp</h2>
              <span className="badge badge-yellow">{data.lowStock} sản phẩm</span>
            </div>
            <p className="text-sm text-gray-500">Có {data.lowStock} sản phẩm sắp hết hàng. <a href="/stock" className="text-blue-600 underline">Xem ngay</a></p>
          </div>
        )}

        {/* Đơn hàng gần đây */}
        <div className="card">
          <h2 className="font-semibold mb-4">Đơn hàng trong kỳ</h2>
          <div className="space-y-3">
            {data?.recentOrders?.map((o: any) => (
              <div key={o.id} className="flex items-center justify-between text-sm">
                <div>
                  <p className="font-medium">{o.orderCode}</p>
                  <p className="text-gray-400">{o.customer?.name || 'Khách lẻ'}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-green-600">{fmt(o.total)}</p>
                  <p className="text-gray-400">{format(new Date(o.createdAt), 'HH:mm dd/MM')}</p>
                </div>
              </div>
            ))}
            {!data?.recentOrders?.length && <p className="text-gray-400 text-sm">Không có đơn hàng trong kỳ này</p>}
          </div>
        </div>
      </div>
    </div>
  )
}

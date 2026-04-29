import { useQuery } from '@tanstack/react-query'
import api from '../../services/api'
import { ShoppingCart, Package, Users, AlertTriangle, TrendingUp } from 'lucide-react'
import { format } from 'date-fns'
import { vi } from 'date-fns/locale'

const fmt = (n: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n)

export default function Dashboard() {
  const { data, isLoading } = useQuery({ queryKey: ['dashboard'], queryFn: () => api.get('/reports/dashboard').then(r => r.data) })

  if (isLoading) return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" /></div>

  const stats = [
    { label: 'Doanh thu hôm nay', value: fmt(data?.todayRevenue || 0), icon: TrendingUp, color: 'bg-green-500', bg: 'bg-green-50' },
    { label: 'Đơn hàng hôm nay', value: data?.todayOrders || 0, icon: ShoppingCart, color: 'bg-blue-500', bg: 'bg-blue-50' },
    { label: 'Tổng sản phẩm', value: data?.totalProducts || 0, icon: Package, color: 'bg-purple-500', bg: 'bg-purple-50' },
    { label: 'Tổng khách hàng', value: data?.totalCustomers || 0, icon: Users, color: 'bg-orange-500', bg: 'bg-orange-50' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Tổng quan</h1>
        <p className="text-gray-500 text-sm">{format(new Date(), 'EEEE, dd/MM/yyyy', { locale: vi })}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="card flex items-center gap-4">
            <div className={`${bg} p-3 rounded-xl`}>
              <Icon className={`${color} text-white`} size={24} style={{ background: 'transparent' }} />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{value}</p>
              <p className="text-sm text-gray-500">{label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Hàng sắp hết */}
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
          <h2 className="font-semibold mb-4">Đơn hàng gần đây</h2>
          <div className="space-y-3">
            {data?.recentOrders?.map((o: any) => (
              <div key={o.id} className="flex items-center justify-between text-sm">
                <div>
                  <p className="font-medium">{o.orderCode}</p>
                  <p className="text-gray-400">{o.customer?.name || 'Khách lẻ'}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-green-600">{fmt(o.total)}</p>
                  <p className="text-gray-400">{format(new Date(o.createdAt), 'HH:mm')}</p>
                </div>
              </div>
            ))}
            {!data?.recentOrders?.length && <p className="text-gray-400 text-sm">Chưa có đơn hàng hôm nay</p>}
          </div>
        </div>
      </div>
    </div>
  )
}

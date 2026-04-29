import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import {
  LayoutDashboard, ShoppingCart, Package, Users, Truck,
  ClipboardList, Warehouse, ArrowLeftRight, CreditCard,
  BarChart2, TrendingUp, LogOut, Store, UserCog
} from 'lucide-react'

const nav = [
  { to: '/', icon: LayoutDashboard, label: 'Tổng quan' },
  { to: '/pos', icon: ShoppingCart, label: 'Bán hàng (POS)' },
  { to: '/orders', icon: ClipboardList, label: 'Đơn hàng' },
  { to: '/products', icon: Package, label: 'Sản phẩm' },
  { to: '/categories', icon: Store, label: 'Danh mục' },
  { to: '/stock', icon: Warehouse, label: 'Kho hàng' },
  { to: '/customers', icon: Users, label: 'Khách hàng' },
  { to: '/suppliers', icon: Truck, label: 'Nhà cung cấp' },
  { to: '/expenses', icon: ArrowLeftRight, label: 'Thu chi' },
  { to: '/debts', icon: CreditCard, label: 'Công nợ' },
  { to: '/reports', icon: BarChart2, label: 'Báo cáo' },
  { to: '/profit-loss', icon: TrendingUp, label: 'Lãi / Lỗ' },
  { to: '/users', icon: UserCog, label: 'Nhân viên' },
]

export default function Layout() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()

  const handleLogout = () => { logout(); navigate('/login') }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-60 bg-gray-900 text-white flex flex-col flex-shrink-0">
        <div className="p-4 border-b border-gray-700">
          <h1 className="text-xl font-bold text-blue-400">POS System</h1>
          <p className="text-xs text-gray-400 mt-1">{user?.name}</p>
        </div>
        <nav className="flex-1 overflow-y-auto py-2">
          {nav.map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${isActive ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-800'}`
            }>
              <Icon size={18} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-gray-700">
          <button onClick={handleLogout} className="flex items-center gap-2 text-gray-400 hover:text-white text-sm w-full">
            <LogOut size={16} /> Đăng xuất
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-6">
          <Outlet />
        </div>
      </main>
    </div>
  )
}

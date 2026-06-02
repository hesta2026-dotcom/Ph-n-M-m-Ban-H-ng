import { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import {
  LayoutDashboard, ShoppingCart, Package, Users, Truck,
  ClipboardList, Warehouse, ArrowLeftRight, CreditCard,
  BarChart2, TrendingUp, LogOut, Store, UserCog, Menu, X, ChevronRight
} from 'lucide-react'

const nav = [
  { to: '/',            icon: LayoutDashboard, label: 'Tổng quan' },
  { to: '/pos',         icon: ShoppingCart,    label: 'Bán hàng' },
  { to: '/orders',      icon: ClipboardList,   label: 'Đơn hàng' },
  { to: '/products',    icon: Package,         label: 'Sản phẩm' },
  { to: '/categories',  icon: Store,           label: 'Danh mục' },
  { to: '/stock',       icon: Warehouse,       label: 'Kho hàng' },
  { to: '/customers',   icon: Users,           label: 'Khách hàng' },
  { to: '/suppliers',   icon: Truck,           label: 'Nhà cung cấp' },
  { to: '/expenses',    icon: ArrowLeftRight,  label: 'Thu chi' },
  { to: '/debts',       icon: CreditCard,      label: 'Công nợ' },
  { to: '/reports',     icon: BarChart2,       label: 'Báo cáo' },
  { to: '/profit-loss', icon: TrendingUp,      label: 'Lãi / Lỗ' },
  { to: '/users',       icon: UserCog,         label: 'Nhân viên' },
]

const bottomTabs = [
  { to: '/',       icon: LayoutDashboard, label: 'Tổng quan' },
  { to: '/pos',    icon: ShoppingCart,    label: 'Bán hàng' },
  { to: '/orders', icon: ClipboardList,   label: 'Đơn hàng' },
  { to: '/stock',  icon: Warehouse,       label: 'Kho hàng' },
]

export default function Layout() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const [drawerOpen, setDrawerOpen] = useState(false)

  const handleLogout = () => { logout(); navigate('/login') }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">

      {/* Sidebar — Desktop */}
      <aside className="hidden md:flex w-60 bg-gray-900 text-white flex-col flex-shrink-0">
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

      {/* Main area */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Top header — Mobile */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 bg-gray-900 text-white flex-shrink-0">
          <div>
            <h1 className="text-base font-bold text-blue-400">POS System</h1>
            <p className="text-xs text-gray-400">{user?.name}</p>
          </div>
          <button onClick={() => setDrawerOpen(true)} className="p-2 rounded-lg hover:bg-gray-800">
            <Menu size={22} />
          </button>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 md:p-6 pb-24 md:pb-6">
            <Outlet />
          </div>
        </main>

        {/* Bottom nav — Mobile */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex z-40 shadow-lg">
          {bottomTabs.map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5 text-xs font-medium ${isActive ? 'text-blue-600' : 'text-gray-500'}`
            }>
              <Icon size={20} />
              <span>{label}</span>
            </NavLink>
          ))}
          <button onClick={() => setDrawerOpen(true)}
            className="flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5 text-xs font-medium text-gray-500">
            <Menu size={20} />
            <span>Thêm</span>
          </button>
        </nav>
      </div>

      {/* Drawer — Mobile */}
      {drawerOpen && (
        <>
          <div className="md:hidden fixed inset-0 bg-black/50 z-50" onClick={() => setDrawerOpen(false)} />
          <div className="md:hidden fixed top-0 right-0 h-full w-72 bg-gray-900 text-white z-50 flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
              <div>
                <p className="font-semibold">{user?.name}</p>
                <p className="text-xs text-gray-400">{user?.email}</p>
              </div>
              <button onClick={() => setDrawerOpen(false)} className="p-2 rounded-lg hover:bg-gray-800">
                <X size={20} />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto py-3">
              {nav.map(({ to, icon: Icon, label }) => (
                <NavLink key={to} to={to} end={to === '/'}
                  onClick={() => setDrawerOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-5 py-3 text-sm transition-colors ${isActive ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-800'}`
                  }>
                  <Icon size={18} />
                  <span className="flex-1">{label}</span>
                  <ChevronRight size={14} className="opacity-40" />
                </NavLink>
              ))}
            </nav>
            <div className="p-4 border-t border-gray-700">
              <button onClick={handleLogout}
                className="flex items-center gap-3 text-red-400 hover:text-red-300 text-sm w-full py-2 px-1 rounded-lg hover:bg-gray-800">
                <LogOut size={16} /> Đăng xuất
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

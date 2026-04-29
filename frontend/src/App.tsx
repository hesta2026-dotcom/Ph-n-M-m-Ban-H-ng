import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './stores/authStore'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/dashboard/Dashboard'
import POS from './pages/pos/POS'
import Products from './pages/products/Products'
import Categories from './pages/products/Categories'
import Customers from './pages/customers/Customers'
import Suppliers from './pages/suppliers/Suppliers'
import Orders from './pages/orders/Orders'
import Stock from './pages/stock/Stock'
import Expenses from './pages/expenses/Expenses'
import Debts from './pages/debts/Debts'
import Users from './pages/users/Users'
import Reports from './pages/reports/Reports'
import ProfitLoss from './pages/reports/ProfitLoss'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { token } = useAuthStore()
  return token ? <>{children}</> : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
          <Route index element={<Dashboard />} />
          <Route path="pos" element={<POS />} />
          <Route path="products" element={<Products />} />
          <Route path="categories" element={<Categories />} />
          <Route path="customers" element={<Customers />} />
          <Route path="suppliers" element={<Suppliers />} />
          <Route path="orders" element={<Orders />} />
          <Route path="stock" element={<Stock />} />
          <Route path="expenses" element={<Expenses />} />
          <Route path="debts" element={<Debts />} />
          <Route path="users" element={<Users />} />
          <Route path="reports" element={<Reports />} />
          <Route path="profit-loss" element={<ProfitLoss />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

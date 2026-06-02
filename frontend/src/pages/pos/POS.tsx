import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../../services/api'
import toast from 'react-hot-toast'
import { Search, Plus, Minus, Trash2, ShoppingCart, User, Printer, X, ChevronDown } from 'lucide-react'

const fmt = (n: number) => new Intl.NumberFormat('vi-VN').format(n) + 'đ'
const fmtM = (n: number) => n === 0 ? '' : n.toLocaleString('vi-VN')
const parseM = (s: string) => +s.replace(/[^0-9]/g, '') || 0

interface CartItem { productId: string; name: string; brand: string; specification: string; image: string; price: number; qty: number; stock: number }

export default function POS() {
  const [search, setSearch] = useState('')
  const [cart, setCart] = useState<CartItem[]>([])
  const [customerId, setCustomerId] = useState('')
  const [customerSearch, setCustomerSearch] = useState('')
  const [showCustomers, setShowCustomers] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState('CASH')
  const [amountPaid, setAmountPaid] = useState(0)
  const [discount, setDiscount] = useState(0)
  const [showCart, setShowCart] = useState(false)
  const qc = useQueryClient()

  const { data: products } = useQuery({
    queryKey: ['products-pos', search],
    queryFn: () => api.get(`/products?search=${search}&limit=24`).then(r => r.data.data),
  })
  const { data: customers } = useQuery({
    queryKey: ['customers-pos', customerSearch],
    queryFn: () => api.get(`/customers?search=${customerSearch}&limit=5`).then(r => r.data.data),
    enabled: customerSearch.length > 0
  })

  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0)
  const total = subtotal - discount
  const change = amountPaid - total
  const totalQty = cart.reduce((s, i) => s + i.qty, 0)

  const addToCart = (p: any) => {
    const imgs: string[] = p.images ? JSON.parse(p.images) : []
    setCart(prev => {
      const exists = prev.find(i => i.productId === p.id)
      if (exists) return prev.map(i => i.productId === p.id ? { ...i, qty: i.qty + 1 } : i)
      return [...prev, { productId: p.id, name: p.name, brand: p.brand || '', specification: p.specification || '', image: p.image || imgs[0] || '', price: p.price, qty: 1, stock: p.stock }]
    })
  }

  const updateQty = (productId: string, qty: number) => {
    if (qty <= 0) { setCart(prev => prev.filter(i => i.productId !== productId)); return }
    setCart(prev => prev.map(i => i.productId === productId ? { ...i, qty } : i))
  }

  const { mutate: createOrder, isPending } = useMutation({
    mutationFn: () => api.post('/orders', {
      customerId: customerId || undefined,
      items: cart.map(i => ({ productId: i.productId, price: i.price, qty: i.qty })),
      paymentMethod, discount, amountPaid, channel: 'store'
    }),
    onSuccess: (_res) => {
      toast.success('Đơn hàng thành công!')
      setCart([]); setDiscount(0); setAmountPaid(0); setCustomerId(''); setCustomerSearch(''); setShowCart(false)
      qc.invalidateQueries({ queryKey: ['orders'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      window.print()
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Lỗi tạo đơn hàng')
  })

  /* ─── Cart Panel (dùng chung mobile bottom sheet & desktop sidebar) ─── */
  const CartPanel = () => (
    <div className="flex flex-col h-full">
      {/* Khách hàng */}
      <div className="p-4 border-b">
        <div className="relative">
          <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pl-9 text-sm" placeholder="Tìm khách hàng (tên, SĐT)..."
            value={customerSearch}
            onFocus={() => setShowCustomers(true)}
            onChange={e => { setCustomerSearch(e.target.value); setCustomerId(''); setShowCustomers(true) }} />
          {showCustomers && customers && customers.length > 0 && (
            <div className="absolute z-20 w-full bg-white border rounded-xl shadow-lg mt-1">
              {customers.map((c: any) => (
                <button key={c.id} onClick={() => { setCustomerId(c.id); setCustomerSearch(c.name); setShowCustomers(false) }}
                  className="w-full text-left px-3 py-2.5 hover:bg-blue-50 text-sm border-b last:border-0">
                  <p className="font-medium">{c.name}</p>
                  <p className="text-gray-400 text-xs">{c.phone}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Cart items */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {cart.length === 0 && (
          <div className="flex flex-col items-center justify-center h-32 text-gray-300">
            <ShoppingCart size={32} strokeWidth={1} />
            <p className="text-sm mt-2 text-gray-400">Chưa có sản phẩm</p>
          </div>
        )}
        {cart.map(item => (
          <div key={item.productId} className="flex items-center gap-2 bg-gray-50 rounded-xl p-2.5">
            <div className="w-10 h-10 rounded-lg bg-gray-200 flex-shrink-0 overflow-hidden">
              {item.image
                ? <img src={item.image} alt="" className="w-full h-full object-cover" />
                : <div className="w-full h-full flex items-center justify-center text-lg">📦</div>}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate leading-snug">{item.name}</p>
              <p className="text-blue-600 text-sm font-semibold">{fmt(item.price)}</p>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button onClick={() => updateQty(item.productId, item.qty - 1)}
                className="w-7 h-7 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center">
                <Minus size={12} />
              </button>
              <span className="w-7 text-center text-sm font-bold">{item.qty}</span>
              <button onClick={() => updateQty(item.productId, item.qty + 1)}
                disabled={item.qty >= item.stock}
                className="w-7 h-7 rounded-full bg-blue-100 text-blue-600 hover:bg-blue-200 flex items-center justify-center disabled:opacity-40">
                <Plus size={12} />
              </button>
              <button onClick={() => setCart(c => c.filter(i => i.productId !== item.productId))}
                className="w-7 h-7 rounded-full text-gray-300 hover:text-red-500 hover:bg-red-50 flex items-center justify-center ml-0.5">
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Summary & Payment */}
      <div className="border-t p-4 space-y-3">
        <div className="space-y-2 text-sm">
          <div className="flex justify-between text-gray-500">
            <span>Tạm tính</span><span className="font-medium text-gray-800">{fmt(subtotal)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-500">Giảm giá (đ)</span>
            <input inputMode="numeric" className="w-28 border rounded-lg px-2 py-1.5 text-right text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              value={fmtM(discount)} onChange={e => setDiscount(parseM(e.target.value))} />
          </div>
          <div className="flex justify-between font-bold text-base border-t pt-2">
            <span>Tổng cộng</span>
            <span className="text-blue-600 text-lg">{fmt(total)}</span>
          </div>
        </div>

        {/* Phương thức */}
        <div className="grid grid-cols-4 gap-1.5">
          {[['CASH','Tiền mặt'],['CARD','Thẻ'],['TRANSFER','CK'],['DEBT','Nợ']].map(([v,l]) => (
            <button key={v} onClick={() => setPaymentMethod(v)}
              className={`py-2 rounded-lg text-xs font-semibold border transition-colors ${paymentMethod === v ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
              {l}
            </button>
          ))}
        </div>

        {paymentMethod === 'CASH' && (
          <div className="space-y-2">
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-500">Tiền khách đưa</span>
              <input inputMode="numeric" className="w-28 border rounded-lg px-2 py-1.5 text-right text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                value={fmtM(amountPaid)} onChange={e => setAmountPaid(parseM(e.target.value))} />
            </div>
            {amountPaid > 0 && (
              <div className={`flex justify-between font-semibold px-3 py-2 rounded-lg text-sm ${change >= 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                <span>{change >= 0 ? 'Tiền thối' : 'Còn thiếu'}</span>
                <span>{fmt(Math.abs(change))}</span>
              </div>
            )}
          </div>
        )}

        <button onClick={() => createOrder()} disabled={cart.length === 0 || isPending}
          className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center justify-center gap-2 disabled:opacity-40 transition-colors shadow-sm">
          <Printer size={17} />
          {isPending ? 'Đang xử lý...' : `Thanh toán · ${fmt(total)}`}
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* ─── Desktop layout ─── */}
      <div className="hidden md:flex h-[calc(100vh-5rem)] gap-4">
        {/* Products */}
        <div className="flex-1 flex flex-col gap-3 overflow-hidden">
          <div className="relative flex-shrink-0">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="input pl-10" placeholder="Tìm sản phẩm theo tên, mã, barcode..."
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="flex-1 overflow-y-auto grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 content-start">
            {products?.map((p: any) => {
              const imgs: string[] = p.images ? JSON.parse(p.images) : []
              const thumb = p.image || imgs[0]
              return (
                <button key={p.id} onClick={() => addToCart(p)} disabled={p.stock === 0}
                  className="bg-white border rounded-xl p-3 text-left hover:border-blue-400 hover:shadow-md transition-all disabled:opacity-40 relative">
                  {p.stock === 0 && <span className="absolute top-2 right-2 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">Hết</span>}
                  <div className="aspect-square bg-gray-100 rounded-lg mb-2 flex items-center justify-center overflow-hidden">
                    {thumb ? <img src={thumb} alt={p.name} className="w-full h-full object-cover" /> : <span className="text-3xl">📦</span>}
                  </div>
                  <p className="text-sm font-medium line-clamp-2 leading-tight">{p.name}</p>
                  {p.brand && <p className="text-xs text-purple-500 mt-0.5 truncate">{p.brand}</p>}
                  <p className="text-blue-600 font-semibold text-sm mt-1">{fmt(p.price)}</p>
                  <p className="text-xs text-gray-400">Còn: {p.stock} {p.unit}</p>
                </button>
              )
            })}
          </div>
        </div>
        {/* Cart sidebar */}
        <div className="w-80 flex flex-col bg-white rounded-xl border overflow-hidden flex-shrink-0">
          <div className="px-4 py-3 border-b bg-gray-50 flex items-center gap-2">
            <ShoppingCart size={18} className="text-blue-600" />
            <span className="font-bold">Giỏ hàng</span>
            {cart.length > 0 && <span className="bg-blue-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center ml-auto">{totalQty}</span>}
          </div>
          <CartPanel />
        </div>
      </div>

      {/* ─── Mobile layout ─── */}
      <div className="md:hidden flex flex-col gap-3 h-full">
        {/* Search */}
        <div className="relative flex-shrink-0">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pl-10 h-11" placeholder="Tìm sản phẩm..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        {/* Product grid — 2 cột */}
        <div className="flex-1 overflow-y-auto grid grid-cols-2 gap-2.5 content-start pb-20">
          {products?.map((p: any) => {
            const imgs: string[] = p.images ? JSON.parse(p.images) : []
            const thumb = p.image || imgs[0]
            const inCart = cart.find(i => i.productId === p.id)
            return (
              <button key={p.id} onClick={() => addToCart(p)} disabled={p.stock === 0}
                className={`bg-white border-2 rounded-xl p-2.5 text-left transition-all disabled:opacity-40 relative active:scale-95 ${inCart ? 'border-blue-400 bg-blue-50/30' : 'border-gray-100 hover:border-blue-300'}`}>
                {p.stock === 0 && (
                  <span className="absolute top-1.5 right-1.5 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full font-medium">Hết</span>
                )}
                {inCart && (
                  <span className="absolute top-1.5 right-1.5 bg-blue-600 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">{inCart.qty}</span>
                )}
                <div className="aspect-square bg-gray-100 rounded-lg mb-2 flex items-center justify-center overflow-hidden">
                  {thumb ? <img src={thumb} alt={p.name} className="w-full h-full object-cover" /> : <span className="text-2xl">📦</span>}
                </div>
                <p className="text-xs font-semibold line-clamp-2 leading-tight text-gray-800">{p.name}</p>
                {p.brand && <p className="text-xs text-purple-500 mt-0.5 truncate">{p.brand}</p>}
                <p className="text-blue-600 font-bold text-sm mt-1">{fmt(p.price)}</p>
                <p className="text-xs text-gray-400">Còn: {p.stock}</p>
              </button>
            )
          })}
        </div>

        {/* Floating cart button */}
        {cart.length > 0 && (
          <button onClick={() => setShowCart(true)}
            className="fixed bottom-20 right-4 z-30 bg-blue-600 text-white rounded-2xl px-4 py-3 shadow-lg flex items-center gap-3 active:scale-95 transition-transform">
            <div className="relative">
              <ShoppingCart size={22} />
              <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">{totalQty}</span>
            </div>
            <div className="text-left">
              <p className="text-xs font-medium opacity-80">Giỏ hàng</p>
              <p className="text-base font-bold leading-none">{fmt(total)}</p>
            </div>
            <ChevronDown size={16} className="opacity-70 rotate-180" />
          </button>
        )}
      </div>

      {/* ─── Mobile cart bottom sheet ─── */}
      {showCart && (
        <>
          <div className="md:hidden fixed inset-0 bg-black/50 z-50" onClick={() => setShowCart(false)} />
          <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white z-50 rounded-t-2xl flex flex-col shadow-2xl"
            style={{ maxHeight: '85vh' }}>
            {/* Handle + header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b flex-shrink-0">
              <div className="flex items-center gap-2">
                <ShoppingCart size={18} className="text-blue-600" />
                <span className="font-bold text-base">Giỏ hàng</span>
                <span className="bg-blue-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">{totalQty}</span>
              </div>
              <button onClick={() => setShowCart(false)} className="p-1.5 rounded-lg hover:bg-gray-100">
                <X size={20} className="text-gray-500" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <CartPanel />
            </div>
          </div>
        </>
      )}
    </>
  )
}

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../../services/api'
import toast from 'react-hot-toast'
import { Search, Plus, Minus, Trash2, ShoppingCart, User, Printer } from 'lucide-react'

const fmt = (n: number) => new Intl.NumberFormat('vi-VN').format(n) + 'đ'

interface CartItem { productId: string; name: string; price: number; qty: number; stock: number }

export default function POS() {
  const [search, setSearch] = useState('')
  const [cart, setCart] = useState<CartItem[]>([])
  const [customerId, setCustomerId] = useState('')
  const [customerSearch, setCustomerSearch] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('CASH')
  const [amountPaid, setAmountPaid] = useState(0)
  const [discount, setDiscount] = useState(0)
  const qc = useQueryClient()

  const { data: products } = useQuery({
    queryKey: ['products-pos', search],
    queryFn: () => api.get(`/products?search=${search}&limit=24`).then(r => r.data.data),
    enabled: true
  })

  const { data: customers } = useQuery({
    queryKey: ['customers-pos', customerSearch],
    queryFn: () => api.get(`/customers?search=${customerSearch}&limit=5`).then(r => r.data.data),
    enabled: customerSearch.length > 0
  })

  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0)
  const total = subtotal - discount
  const change = amountPaid - total

  const addToCart = (p: any) => {
    setCart(prev => {
      const exists = prev.find(i => i.productId === p.id)
      if (exists) return prev.map(i => i.productId === p.id ? { ...i, qty: i.qty + 1 } : i)
      return [...prev, { productId: p.id, name: p.name, price: p.price, qty: 1, stock: p.stock }]
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
    onSuccess: (res) => {
      toast.success('Tạo đơn hàng thành công!')
      setCart([]); setDiscount(0); setAmountPaid(0); setCustomerId(''); setCustomerSearch('')
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      window.print()
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Lỗi tạo đơn hàng')
  })

  return (
    <div className="flex h-[calc(100vh-5rem)] gap-4">
      {/* Left - Products */}
      <div className="flex-1 flex flex-col gap-4 overflow-hidden">
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pl-10" placeholder="Tìm sản phẩm theo tên, mã, barcode..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex-1 overflow-y-auto grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 content-start">
          {products?.map((p: any) => (
            <button key={p.id} onClick={() => addToCart(p)} disabled={p.stock === 0}
              className="bg-white border rounded-xl p-3 text-left hover:border-blue-400 hover:shadow-md transition-all disabled:opacity-40 disabled:cursor-not-allowed">
              <div className="aspect-square bg-gray-100 rounded-lg mb-2 flex items-center justify-center">
                {p.image ? <img src={p.image} className="w-full h-full object-cover rounded-lg" /> : <span className="text-2xl">📦</span>}
              </div>
              <p className="text-sm font-medium line-clamp-2">{p.name}</p>
              <p className="text-blue-600 font-semibold text-sm mt-1">{fmt(p.price)}</p>
              <p className="text-xs text-gray-400">Còn: {p.stock}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Right - Cart */}
      <div className="w-96 flex flex-col gap-3 bg-white rounded-xl border p-4">
        <h2 className="font-bold text-lg flex items-center gap-2"><ShoppingCart size={20} /> Giỏ hàng</h2>

        {/* Customer */}
        <div className="relative">
          <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pl-9 text-sm" placeholder="Tìm khách hàng (tên, SĐT)..." value={customerSearch} onChange={e => setCustomerSearch(e.target.value)} />
          {customers && customers.length > 0 && (
            <div className="absolute z-10 w-full bg-white border rounded-lg shadow-lg mt-1">
              {customers.map((c: any) => (
                <button key={c.id} onClick={() => { setCustomerId(c.id); setCustomerSearch(c.name) }} className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm">
                  <p className="font-medium">{c.name}</p>
                  <p className="text-gray-400">{c.phone}</p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Cart items */}
        <div className="flex-1 overflow-y-auto space-y-2">
          {cart.length === 0 && <p className="text-center text-gray-400 py-8">Chưa có sản phẩm nào</p>}
          {cart.map(item => (
            <div key={item.productId} className="flex items-center gap-2 bg-gray-50 rounded-lg p-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{item.name}</p>
                <p className="text-blue-600 text-sm">{fmt(item.price)}</p>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => updateQty(item.productId, item.qty - 1)} className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center hover:bg-gray-300"><Minus size={12} /></button>
                <span className="w-8 text-center text-sm font-medium">{item.qty}</span>
                <button onClick={() => updateQty(item.productId, item.qty + 1)} disabled={item.qty >= item.stock} className="w-7 h-7 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center hover:bg-blue-200 disabled:opacity-40"><Plus size={12} /></button>
              </div>
              <button onClick={() => setCart(c => c.filter(i => i.productId !== item.productId))} className="text-red-400 hover:text-red-600"><Trash2 size={14} /></button>
            </div>
          ))}
        </div>

        {/* Summary */}
        <div className="border-t pt-3 space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-gray-500">Tạm tính</span><span>{fmt(subtotal)}</span></div>
          <div className="flex justify-between items-center">
            <span className="text-gray-500">Giảm giá</span>
            <input type="number" className="w-28 border rounded px-2 py-1 text-right text-sm" value={discount} onChange={e => setDiscount(+e.target.value)} />
          </div>
          <div className="flex justify-between font-bold text-base"><span>Tổng cộng</span><span className="text-blue-600">{fmt(total)}</span></div>

          <select className="input text-sm" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
            <option value="CASH">Tiền mặt</option>
            <option value="CARD">Thẻ</option>
            <option value="TRANSFER">Chuyển khoản</option>
            <option value="DEBT">Ghi nợ</option>
          </select>

          {paymentMethod === 'CASH' && (
            <>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Tiền khách đưa</span>
                <input type="number" className="w-28 border rounded px-2 py-1 text-right text-sm" value={amountPaid} onChange={e => setAmountPaid(+e.target.value)} />
              </div>
              {amountPaid > 0 && <div className="flex justify-between text-green-600 font-medium"><span>Tiền thối</span><span>{fmt(change > 0 ? change : 0)}</span></div>}
            </>
          )}
        </div>

        <button onClick={() => createOrder()} disabled={cart.length === 0 || isPending} className="btn-primary w-full py-3 text-base flex items-center justify-center gap-2">
          <Printer size={18} /> {isPending ? 'Đang xử lý...' : 'Thanh toán & In hóa đơn'}
        </button>
      </div>
    </div>
  )
}

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../../services/api'
import toast from 'react-hot-toast'
import { Search, Plus, Minus, Trash2, X, User, UserPlus, ChevronUp, ChevronDown, ShoppingBag } from 'lucide-react'
import NewCustomerModal from '../customers/NewCustomerModal'

const fmt = (n: number) => new Intl.NumberFormat('vi-VN').format(n) + 'đ'
const fmtMoney = (n: number) => n === 0 ? '' : n.toLocaleString('vi-VN')
const parseMoney = (s: string) => +s.replace(/[^0-9]/g, '') || 0
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

interface CartItem {
  productId: string; name: string; code: string
  unitPrice: number; price: number
  qty: number; stock: number
  unit: string; packageUnit: string | null; packageQty: number | null
  selectedUnit: string
}
interface Props { onClose: () => void; onSuccess: (order: any) => void }

export default function CreateOrderModal({ onClose, onSuccess }: Props) {
  const qc = useQueryClient()
  const [productSearch, setProductSearch] = useState('')
  const [customerSearch, setCustomerSearch] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [cart, setCart] = useState<CartItem[]>([])
  const [paymentMethod, setPaymentMethod] = useState('CASH')
  const [discount, setDiscount] = useState(0)
  const [amountPaid, setAmountPaid] = useState(0)
  const [note, setNote] = useState('')
  const [channel, setChannel] = useState('store')
  const status = 'PENDING'
  const [showProductSearch, setShowProductSearch] = useState(false)
  const [showCustomerSearch, setShowCustomerSearch] = useState(false)
  const [showNewCustomer, setShowNewCustomer] = useState(false)
  const [showPaymentSheet, setShowPaymentSheet] = useState(false)

  const { data: products } = useQuery({
    queryKey: ['products-search', productSearch],
    queryFn: () => api.get(`/products?search=${productSearch}&limit=8`).then(r => r.data.data),
    enabled: productSearch.length > 0
  })
  const { data: customers } = useQuery({
    queryKey: ['customers-search', customerSearch],
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
      return [...prev, { productId: p.id, name: p.name, code: p.code, unitPrice: p.price, price: p.price, qty: 1, stock: p.stock, unit: p.unit || 'cái', packageUnit: p.packageUnit || null, packageQty: p.packageQty || null, selectedUnit: p.unit || 'cái' }]
    })
    setProductSearch(''); setShowProductSearch(false)
  }
  const updateQty = (productId: string, qty: number) => {
    if (qty <= 0) { setCart(p => p.filter(i => i.productId !== productId)); return }
    setCart(p => p.map(i => i.productId === productId ? { ...i, qty } : i))
  }
  const updatePrice = (productId: string, price: number) =>
    setCart(p => p.map(i => i.productId === productId ? { ...i, price, unitPrice: i.selectedUnit === i.packageUnit && i.packageQty ? price / i.packageQty : price } : i))
  const updateUnit = (productId: string, unit: string) =>
    setCart(p => p.map(i => {
      if (i.productId !== productId) return i
      return { ...i, selectedUnit: unit, price: unit === i.packageUnit && i.packageQty ? i.unitPrice * i.packageQty : i.unitPrice }
    }))

  const { mutate: createOrder, isPending } = useMutation({
    mutationFn: () => api.post('/orders', {
      customerId: customerId || undefined,
      items: cart.map(i => ({ productId: i.productId, price: i.unitPrice, qty: i.selectedUnit === i.packageUnit && i.packageQty ? i.qty * i.packageQty : i.qty, unit: i.selectedUnit })),
      paymentMethod, discount, amountPaid, note, channel, status
    }),
    onSuccess: (res) => { toast.success('Tạo đơn hàng thành công!'); qc.invalidateQueries({ queryKey: ['orders'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }); onSuccess(res.data) },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Lỗi tạo đơn hàng')
  })

  /* ─── PAYMENT PANEL (dùng chung mobile & desktop) ─── */
  const PaymentPanel = () => (
    <div className="flex flex-col h-full">
      <div className="flex-1 p-5 space-y-4 overflow-y-auto">
        <p className="font-bold text-gray-700 text-base hidden md:block">Thanh toán</p>

        <div className="space-y-2 text-sm">
          <div className="flex justify-between text-gray-500">
            <span>Tạm tính</span>
            <span className="font-medium text-gray-800">{fmt(subtotal)}</span>
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Giảm giá (đ)</label>
            <input inputMode="numeric" className="input text-sm text-right w-full"
              value={fmtMoney(discount)} onChange={e => setDiscount(parseMoney(e.target.value))} />
          </div>
          <div className="flex justify-between items-center font-bold text-base pt-2 border-t">
            <span>Tổng cộng</span>
            <span className="text-blue-600 text-lg">{fmt(total)}</span>
          </div>
        </div>

        <div className="space-y-2 text-sm pt-2 border-t">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Kênh bán</label>
            <select className="input text-sm" value={channel} onChange={e => setChannel(e.target.value)}>
              <option value="store">Cửa hàng</option>
              <option value="shopee">Shopee</option>
              <option value="facebook">Facebook</option>
              <option value="web">Website</option>
              <option value="phone">Điện thoại</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Phương thức</label>
            <select className="input text-sm" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
              <option value="CASH">Tiền mặt</option>
              <option value="CARD">Thẻ ngân hàng</option>
              <option value="TRANSFER">Chuyển khoản</option>
              <option value="DEBT">Ghi nợ</option>
            </select>
          </div>
          {paymentMethod === 'CASH' && (
            <>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Tiền khách đưa (đ)</label>
                <input inputMode="numeric" className="input text-sm text-right w-full"
                  value={fmtMoney(amountPaid)} onChange={e => setAmountPaid(parseMoney(e.target.value))} />
              </div>
              {amountPaid > 0 && (
                <div className={`flex justify-between font-semibold px-3 py-2 rounded-lg text-sm ${change >= 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                  <span>{change >= 0 ? 'Tiền thối' : 'Còn thiếu'}</span>
                  <span>{fmt(Math.abs(change))}</span>
                </div>
              )}
            </>
          )}
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Ghi chú</label>
            <input className="input text-sm" placeholder="Ghi chú..." value={note} onChange={e => setNote(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="p-4 border-t">
        <button onClick={() => createOrder()} disabled={cart.length === 0 || isPending}
          className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-base transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-sm">
          {isPending ? 'Đang xử lý...' : `Lưu đơn · ${fmt(total)}`}
        </button>
        {cart.length > 0 && <p className="text-center text-xs text-gray-400 mt-2">{cart.length} sản phẩm</p>}
      </div>
    </div>
  )

  return (
    <>
      {/* ── Overlay ── */}
      <div className="fixed inset-0 bg-black/50 z-50 flex flex-col md:items-center md:justify-center md:p-4">

        {/* ── Modal ── */}
        <div className="bg-white w-full h-full md:h-auto md:rounded-2xl md:max-w-4xl md:max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">

          {/* Header */}
          <div className="flex items-center justify-between px-4 md:px-6 py-3 md:py-4 border-b flex-shrink-0 bg-white">
            <div className="flex items-center gap-2">
              <ShoppingBag size={18} className="text-blue-600" />
              <h2 className="text-base md:text-lg font-bold">Tạo đơn hàng</h2>
              {cart.length > 0 && (
                <span className="bg-blue-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">{cart.length}</span>
              )}
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100">
              <X size={20} />
            </button>
          </div>

          {/* Body */}
          <div className="flex flex-1 overflow-hidden flex-col md:flex-row">

            {/* ─── TRÁI: Giỏ hàng ─── */}
            <div className="flex-1 overflow-hidden flex flex-col">

              {/* Tìm kiếm */}
              <div className="p-3 md:p-4 space-y-2.5 border-b bg-gray-50/60 flex-shrink-0">
                {/* Khách hàng */}
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 z-10" />
                    <input className="input pl-9 text-sm h-10" placeholder="Khách hàng (tên, SĐT)..."
                      value={customerSearch}
                      onFocus={() => setShowCustomerSearch(true)}
                      onChange={e => { setCustomerSearch(e.target.value); setCustomerId(''); setShowCustomerSearch(true) }} />
                    {showCustomerSearch && customers && customers.length > 0 && (
                      <div className="absolute z-30 w-full bg-white border rounded-xl shadow-lg mt-1">
                        {customers.map((c: any) => (
                          <button key={c.id} onClick={() => { setCustomerId(c.id); setCustomerSearch(c.name); setShowCustomerSearch(false) }}
                            className="w-full text-left px-3 py-2.5 hover:bg-blue-50 text-sm border-b last:border-b-0">
                            <p className="font-medium">{c.name}</p>
                            <p className="text-gray-400 text-xs">{c.phone}</p>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <button onClick={() => setShowNewCustomer(true)}
                    className="flex items-center gap-1 px-3 h-10 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 whitespace-nowrap flex-shrink-0">
                    <UserPlus size={13} /> <span className="hidden sm:inline">Tạo mới</span>
                  </button>
                </div>

                {/* Tìm sản phẩm */}
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input className="input pl-9 text-sm h-10" placeholder="Tìm sản phẩm (tên, mã)..."
                    value={productSearch}
                    onFocus={() => setShowProductSearch(true)}
                    onChange={e => { setProductSearch(e.target.value); setShowProductSearch(true) }} />
                  {showProductSearch && products && products.length > 0 && (
                    <div className="absolute z-30 w-full bg-white border rounded-xl shadow-lg mt-1 max-h-52 overflow-y-auto">
                      {products.map((p: any) => (
                        <button key={p.id} onClick={() => addToCart(p)} disabled={p.stock === 0}
                          className="w-full text-left px-3 py-2.5 hover:bg-blue-50 text-sm flex justify-between items-center border-b last:border-b-0 disabled:opacity-40">
                          <div className="min-w-0">
                            <span className="font-medium">{p.name}</span>
                            <span className="text-gray-400 ml-2 text-xs">[{p.code}]</span>
                          </div>
                          <div className="text-right flex-shrink-0 ml-3">
                            <p className="text-blue-600 font-semibold text-xs">{fmt(p.price)}</p>
                            <p className="text-gray-400 text-xs">Tồn: {p.stock}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Giỏ hàng */}
              <div className="flex-1 overflow-y-auto">
                {cart.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full py-12 text-gray-300">
                    <Search size={36} strokeWidth={1} />
                    <p className="mt-3 text-sm text-gray-400">Tìm và thêm sản phẩm ở trên</p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {cart.map(item => {
                      const maxQty = item.selectedUnit === item.packageUnit && item.packageQty ? Math.floor(item.stock / item.packageQty) : item.stock
                      return (
                        <div key={item.productId} className="px-3 md:px-4 py-2.5 hover:bg-gray-50/50">
                          <div className="flex items-start gap-2">
                            {/* Tên + unit */}
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm leading-snug">{item.name}</p>
                              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                <span className="text-xs text-gray-400 font-mono">{item.code}</span>
                                {item.packageUnit && item.packageQty && (
                                  <select value={item.selectedUnit} onChange={e => updateUnit(item.productId, e.target.value)}
                                    className="text-xs border rounded px-1.5 py-0.5 text-gray-600 bg-white">
                                    <option value={item.unit}>{cap(item.unit)}</option>
                                    <option value={item.packageUnit}>{cap(item.packageUnit)} ({item.packageQty})</option>
                                  </select>
                                )}
                              </div>
                            </div>

                            {/* Xóa */}
                            <button onClick={() => setCart(c => c.filter(i => i.productId !== item.productId))}
                              className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0">
                              <Trash2 size={13} />
                            </button>
                          </div>

                          {/* Qty + Giá + Tổng — row */}
                          <div className="flex items-center gap-2 mt-2">
                            {/* Qty controls */}
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <button onClick={() => updateQty(item.productId, item.qty - 1)}
                                className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center">
                                <Minus size={13} />
                              </button>
                              <input type="number" value={item.qty} min={1} max={maxQty}
                                onChange={e => updateQty(item.productId, +e.target.value)}
                                className="w-11 text-center border rounded-lg text-sm py-1 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-300" />
                              <button onClick={() => updateQty(item.productId, item.qty + 1)}
                                disabled={item.qty >= maxQty}
                                className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 flex items-center justify-center disabled:opacity-30">
                                <Plus size={13} />
                              </button>
                            </div>

                            {/* Giá */}
                            <input inputMode="numeric" value={fmtMoney(item.price)}
                              onChange={e => updatePrice(item.productId, parseMoney(e.target.value))}
                              className="flex-1 min-w-0 border rounded-lg text-sm py-1.5 px-2 text-right focus:outline-none focus:ring-2 focus:ring-blue-300" />

                            {/* Thành tiền */}
                            <div className="text-right flex-shrink-0 w-24">
                              <p className="font-bold text-blue-600 text-sm">{fmt(item.price * item.qty)}</p>
                              {item.selectedUnit === item.packageUnit && item.packageQty && (
                                <p className="text-xs text-gray-400">{item.qty * item.packageQty} {item.unit}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* ── Mobile: Bottom bar thanh toán ── */}
              <div className="md:hidden flex-shrink-0 border-t bg-white">
                {/* Toggle payment sheet */}
                <button onClick={() => setShowPaymentSheet(v => !v)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-500">Tổng cộng</span>
                    <span className="text-lg font-bold text-blue-600">{fmt(total)}</span>
                    {discount > 0 && <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">-{fmt(discount)}</span>}
                  </div>
                  {showPaymentSheet ? <ChevronDown size={18} className="text-gray-400" /> : <ChevronUp size={18} className="text-gray-400" />}
                </button>

                {/* Payment sheet mở rộng */}
                {showPaymentSheet && (
                  <div className="border-t px-4 py-3 space-y-3 bg-gray-50/80">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">Giảm giá (đ)</label>
                        <input inputMode="numeric" className="input text-sm text-right"
                          value={fmtMoney(discount)} onChange={e => setDiscount(parseMoney(e.target.value))} />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">Kênh bán</label>
                        <select className="input text-sm" value={channel} onChange={e => setChannel(e.target.value)}>
                          <option value="store">Cửa hàng</option>
                          <option value="shopee">Shopee</option>
                          <option value="facebook">Facebook</option>
                          <option value="web">Website</option>
                          <option value="phone">ĐT</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Phương thức thanh toán</label>
                      <div className="grid grid-cols-4 gap-1.5">
                        {[['CASH','Tiền mặt'],['CARD','Thẻ'],['TRANSFER','CK'],['DEBT','Nợ']].map(([v, l]) => (
                          <button key={v} onClick={() => setPaymentMethod(v)}
                            className={`py-2 rounded-lg text-xs font-medium border transition-colors ${paymentMethod === v ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200'}`}>
                            {l}
                          </button>
                        ))}
                      </div>
                    </div>
                    {paymentMethod === 'CASH' && (
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">Tiền khách đưa (đ)</label>
                        <input inputMode="numeric" className="input text-sm text-right"
                          value={fmtMoney(amountPaid)} onChange={e => setAmountPaid(parseMoney(e.target.value))} />
                        {amountPaid > 0 && (
                          <div className={`flex justify-between font-semibold px-3 py-2 rounded-lg text-sm mt-2 ${change >= 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                            <span>{change >= 0 ? 'Tiền thối' : 'Còn thiếu'}</span>
                            <span>{fmt(Math.abs(change))}</span>
                          </div>
                        )}
                      </div>
                    )}
                    <input className="input text-sm" placeholder="Ghi chú..."
                      value={note} onChange={e => setNote(e.target.value)} />
                  </div>
                )}

                {/* Nút lưu */}
                <div className="px-4 pb-4 pt-2">
                  <button onClick={() => createOrder()} disabled={cart.length === 0 || isPending}
                    className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-base transition-colors disabled:opacity-40 shadow-sm">
                    {isPending ? 'Đang xử lý...' : `Lưu đơn hàng · ${fmt(total)}`}
                  </button>
                </div>
              </div>
            </div>

            {/* ─── PHẢI: Thanh toán (Desktop only) ─── */}
            <div className="hidden md:flex w-64 flex-shrink-0 flex-col bg-gray-50/40 border-l">
              <PaymentPanel />
            </div>
          </div>
        </div>
      </div>

      {showNewCustomer && (
        <NewCustomerModal defaultName={customerSearch} onClose={() => setShowNewCustomer(false)}
          onCreated={(customer) => { setCustomerId(customer.id); setCustomerSearch(customer.name); setShowNewCustomer(false) }} />
      )}
    </>
  )
}

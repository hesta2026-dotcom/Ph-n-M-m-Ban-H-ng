import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../../services/api'
import toast from 'react-hot-toast'
import { Search, Plus, Minus, Trash2, X, User, UserPlus } from 'lucide-react'
import NewCustomerModal from '../customers/NewCustomerModal'

const fmt = (n: number) => new Intl.NumberFormat('vi-VN').format(n) + 'đ'

interface CartItem {
  productId: string; name: string; code: string
  unitPrice: number   // giá gốc theo đơn vị nhỏ nhất
  price: number       // giá hiển thị theo đơn vị đang chọn
  qty: number; stock: number
  unit: string
  packageUnit: string | null
  packageQty: number | null
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
  const [status, setStatus] = useState('COMPLETED')
  const [showProductSearch, setShowProductSearch] = useState(false)
  const [showCustomerSearch, setShowCustomerSearch] = useState(false)
  const [showNewCustomer, setShowNewCustomer] = useState(false)

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
      return [...prev, {
        productId: p.id, name: p.name, code: p.code,
        unitPrice: p.price, price: p.price, qty: 1, stock: p.stock,
        unit: p.unit || 'cái',
        packageUnit: p.packageUnit || null,
        packageQty: p.packageQty || null,
        selectedUnit: p.unit || 'cái'
      }]
    })
    setProductSearch('')
    setShowProductSearch(false)
  }

  const updateQty = (productId: string, qty: number) => {
    if (qty <= 0) { setCart(p => p.filter(i => i.productId !== productId)); return }
    setCart(p => p.map(i => i.productId === productId ? { ...i, qty } : i))
  }

  const updatePrice = (productId: string, price: number) => {
    setCart(p => p.map(i => i.productId === productId ? { ...i, price, unitPrice: i.selectedUnit === i.packageUnit && i.packageQty ? price / i.packageQty : price } : i))
  }

  const updateUnit = (productId: string, unit: string) => {
    setCart(p => p.map(i => {
      if (i.productId !== productId) return i
      const newPrice = unit === i.packageUnit && i.packageQty ? i.unitPrice * i.packageQty : i.unitPrice
      return { ...i, selectedUnit: unit, price: newPrice }
    }))
  }

  const { mutate: createOrder, isPending } = useMutation({
    mutationFn: () => api.post('/orders', {
      customerId: customerId || undefined,
      items: cart.map(i => ({
        productId: i.productId,
        price: i.unitPrice,
        qty: i.selectedUnit === i.packageUnit && i.packageQty ? i.qty * i.packageQty : i.qty
      })),
      paymentMethod, discount, amountPaid, note, channel, status
    }),
    onSuccess: (res) => {
      toast.success('Tạo đơn hàng thành công!')
      qc.invalidateQueries({ queryKey: ['orders'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      onSuccess(res.data)
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Lỗi tạo đơn hàng')
  })

  return (
    <>
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0">
          <h2 className="text-lg font-bold">Tạo đơn hàng mới</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Left: products & info */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4 border-r">
            {/* Customer */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm font-medium text-gray-700">Khách hàng</label>
                <button type="button" onClick={() => setShowNewCustomer(true)}
                  className="flex items-center gap-1 text-xs text-green-600 hover:text-green-700 font-medium">
                  <UserPlus size={13} /> Tạo mới
                </button>
              </div>
              <div className="relative">
                <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  className="input pl-9 text-sm"
                  placeholder="Tìm theo tên, SĐT..."
                  value={customerSearch}
                  onFocus={() => setShowCustomerSearch(true)}
                  onChange={e => { setCustomerSearch(e.target.value); setCustomerId(''); setShowCustomerSearch(true) }}
                />
                {showCustomerSearch && customers && customers.length > 0 && (
                  <div className="absolute z-20 w-full bg-white border rounded-lg shadow-lg mt-1">
                    {customers.map((c: any) => (
                      <button key={c.id} onClick={() => { setCustomerId(c.id); setCustomerSearch(c.name); setShowCustomerSearch(false) }}
                        className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm">
                        <p className="font-medium">{c.name}</p>
                        <p className="text-gray-400 text-xs">{c.phone}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Product search */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Thêm sản phẩm</label>
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  className="input pl-9 text-sm"
                  placeholder="Tìm theo tên, mã, barcode..."
                  value={productSearch}
                  onFocus={() => setShowProductSearch(true)}
                  onChange={e => { setProductSearch(e.target.value); setShowProductSearch(true) }}
                />
                {showProductSearch && products && products.length > 0 && (
                  <div className="absolute z-20 w-full bg-white border rounded-lg shadow-lg mt-1 max-h-56 overflow-y-auto">
                    {products.map((p: any) => (
                      <button key={p.id} onClick={() => addToCart(p)}
                        disabled={p.stock === 0}
                        className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm flex justify-between items-center disabled:opacity-40">
                        <div>
                          <span className="font-medium">{p.name}</span>
                          <span className="text-gray-400 ml-2 text-xs">[{p.code}]</span>
                        </div>
                        <div className="text-right flex-shrink-0 ml-4">
                          <p className="text-blue-600 font-medium">{fmt(p.price)}</p>
                          <p className="text-gray-400 text-xs">Kho: {p.stock}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Cart items */}
            {cart.length > 0 && (
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-gray-600">Sản phẩm</th>
                      <th className="px-3 py-2 text-center font-medium text-gray-600">SL / Đơn vị</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-600">Đơn giá</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-600">Thành tiền</th>
                      <th className="w-8"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {cart.map(item => (
                      <tr key={item.productId}>
                        <td className="px-3 py-2">
                          <p className="font-medium">{item.name}</p>
                          <p className="text-gray-400 text-xs">{item.code}</p>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex flex-col items-center gap-1">
                            <div className="flex items-center gap-1">
                              <button onClick={() => updateQty(item.productId, item.qty - 1)}
                                className="w-6 h-6 rounded bg-gray-100 hover:bg-gray-200 flex items-center justify-center">
                                <Minus size={10} />
                              </button>
                              <input type="number" value={item.qty} min={1}
                                max={item.selectedUnit === item.packageUnit && item.packageQty ? Math.floor(item.stock / item.packageQty) : item.stock}
                                onChange={e => updateQty(item.productId, +e.target.value)}
                                className="w-12 text-center border rounded text-sm py-0.5" />
                              <button onClick={() => updateQty(item.productId, item.qty + 1)}
                                disabled={item.selectedUnit === item.packageUnit && item.packageQty ? item.qty >= Math.floor(item.stock / item.packageQty) : item.qty >= item.stock}
                                className="w-6 h-6 rounded bg-blue-50 text-blue-600 hover:bg-blue-100 flex items-center justify-center disabled:opacity-40">
                                <Plus size={10} />
                              </button>
                            </div>
                            <select
                              value={item.selectedUnit}
                              onChange={e => updateUnit(item.productId, e.target.value)}
                              className="text-xs border rounded px-1 py-0.5 text-gray-600 bg-gray-50 w-full max-w-[90px]">
                              <option value={item.unit}>{item.unit.charAt(0).toUpperCase() + item.unit.slice(1)}</option>
                              {item.packageUnit && item.packageQty && (
                                <option value={item.packageUnit}>
                                  {item.packageUnit.charAt(0).toUpperCase() + item.packageUnit.slice(1)} ({item.packageQty} {item.unit})
                                </option>
                              )}
                            </select>
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <input type="number" value={item.price}
                            onChange={e => updatePrice(item.productId, +e.target.value)}
                            className="w-28 border rounded text-sm py-0.5 px-2 text-right" />
                        </td>
                        <td className="px-3 py-2 text-right font-medium text-blue-600">
                          <p>{fmt(item.price * item.qty)}</p>
                          {item.selectedUnit === item.packageUnit && item.packageQty && (
                            <p className="text-xs text-gray-400">{item.qty * item.packageQty} {item.unit}</p>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <button onClick={() => setCart(c => c.filter(i => i.productId !== item.productId))}
                            className="text-red-400 hover:text-red-600"><Trash2 size={13} /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {cart.length === 0 && (
              <div className="border-2 border-dashed rounded-lg py-10 text-center text-gray-400 text-sm">
                Chưa có sản phẩm nào — tìm và thêm sản phẩm ở trên
              </div>
            )}

            {/* Note & Channel */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Kênh bán</label>
                <select className="input text-sm" value={channel} onChange={e => setChannel(e.target.value)}>
                  <option value="store">Cửa hàng</option>
                  <option value="shopee">Shopee</option>
                  <option value="facebook">Facebook</option>
                  <option value="web">Website</option>
                  <option value="phone">Điện thoại</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Trạng thái</label>
                <select className="input text-sm" value={status} onChange={e => setStatus(e.target.value)}>
                  <option value="COMPLETED">Hoàn thành</option>
                  <option value="PENDING">Chờ xử lý</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Ghi chú</label>
              <textarea className="input text-sm resize-none" rows={2} placeholder="Ghi chú đơn hàng..."
                value={note} onChange={e => setNote(e.target.value)} />
            </div>
          </div>

          {/* Right: payment summary */}
          <div className="w-64 flex-shrink-0 p-6 flex flex-col gap-4">
            <h3 className="font-semibold text-gray-700">Thanh toán</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Tạm tính</span>
                <span className="font-medium">{fmt(subtotal)}</span>
              </div>
              <div>
                <span className="text-gray-500 block mb-1">Giảm giá</span>
                <input type="number" className="input text-sm text-right" value={discount}
                  onChange={e => setDiscount(+e.target.value)} />
              </div>
              <div className="flex justify-between font-bold text-base pt-2 border-t">
                <span>Tổng cộng</span>
                <span className="text-blue-600">{fmt(total)}</span>
              </div>
            </div>

            <div className="space-y-3 text-sm">
              <div>
                <label className="text-gray-500 block mb-1">Phương thức</label>
                <select className="input text-sm" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
                  <option value="CASH">Tiền mặt</option>
                  <option value="CARD">Thẻ</option>
                  <option value="TRANSFER">Chuyển khoản</option>
                  <option value="DEBT">Ghi nợ</option>
                </select>
              </div>
              {paymentMethod === 'CASH' && (
                <>
                  <div>
                    <label className="text-gray-500 block mb-1">Tiền khách đưa</label>
                    <input type="number" className="input text-sm text-right" value={amountPaid}
                      onChange={e => setAmountPaid(+e.target.value)} />
                  </div>
                  {amountPaid > 0 && (
                    <div className="flex justify-between text-green-600 font-medium">
                      <span>Tiền thối</span>
                      <span>{fmt(change > 0 ? change : 0)}</span>
                    </div>
                  )}
                </>
              )}
            </div>

            <button
              onClick={() => createOrder()}
              disabled={cart.length === 0 || isPending}
              className="btn-primary w-full mt-auto py-3">
              {isPending ? 'Đang xử lý...' : 'Lưu đơn hàng'}
            </button>
          </div>
        </div>
      </div>
    </div>

    {showNewCustomer && (
      <NewCustomerModal
        defaultName={customerSearch}
        onClose={() => setShowNewCustomer(false)}
        onCreated={(customer) => {
          setCustomerId(customer.id)
          setCustomerSearch(customer.name)
          setShowNewCustomer(false)
        }}
      />
    )}
    </>
  )
}

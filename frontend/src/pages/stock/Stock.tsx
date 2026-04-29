import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../../services/api'
import toast from 'react-hot-toast'
import { AlertTriangle, Plus } from 'lucide-react'

const fmt = (n: number) => new Intl.NumberFormat('vi-VN').format(n) + 'đ'

export default function Stock() {
  const [tab, setTab] = useState<'low' | 'logs' | 'purchase'>('low')
  const [showAdjust, setShowAdjust] = useState(false)
  const [adjustForm, setAdjustForm] = useState({ productId: '', newStock: 0, note: '' })
  const [showPurchase, setShowPurchase] = useState(false)
  const qc = useQueryClient()

  const { data: lowStock } = useQuery({ queryKey: ['low-stock'], queryFn: () => api.get('/stock/low').then(r => r.data) })
  const { data: logs } = useQuery({ queryKey: ['stock-logs'], queryFn: () => api.get('/stock/logs?limit=50').then(r => r.data), enabled: tab === 'logs' })
  const { data: purchases } = useQuery({ queryKey: ['purchases'], queryFn: () => api.get('/purchases?limit=20').then(r => r.data), enabled: tab === 'purchase' })
  const { data: products } = useQuery({ queryKey: ['products-all'], queryFn: () => api.get('/products?limit=1000').then(r => r.data.data) })
  const { data: suppliers } = useQuery({ queryKey: ['suppliers'], queryFn: () => api.get('/suppliers').then(r => r.data) })

  const adjust = useMutation({
    mutationFn: (d: any) => api.post('/stock/adjust', d),
    onSuccess: () => { toast.success('Đã điều chỉnh kho'); qc.invalidateQueries({ queryKey: ['low-stock'] }); qc.invalidateQueries({ queryKey: ['stock-logs'] }); setShowAdjust(false) },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Lỗi')
  })

  const [purchaseForm, setPurchaseForm] = useState({ supplierId: '', paid: 0, note: '', items: [{ productId: '', qty: 1, costPrice: 0 }] })

  const addPurchaseItem = () => setPurchaseForm(p => ({ ...p, items: [...p.items, { productId: '', qty: 1, costPrice: 0 }] }))
  const updatePurchaseItem = (i: number, key: string, val: any) => setPurchaseForm(p => ({ ...p, items: p.items.map((item, idx) => idx === i ? { ...item, [key]: val } : item) }))

  const purchase = useMutation({
    mutationFn: (d: any) => api.post('/purchases', d),
    onSuccess: () => { toast.success('Nhập kho thành công'); qc.invalidateQueries({ queryKey: ['purchases'] }); qc.invalidateQueries({ queryKey: ['low-stock'] }); setShowPurchase(false) },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Lỗi')
  })

  const logTypeLabel: any = { IMPORT: 'Nhập kho', EXPORT: 'Xuất kho', ADJUST: 'Điều chỉnh', RETURN: 'Hoàn hàng' }
  const logTypeClass: any = { IMPORT: 'badge-green', EXPORT: 'badge-red', ADJUST: 'badge-yellow', RETURN: 'badge-blue' }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Kho hàng</h1>
        <div className="flex gap-2">
          <button onClick={() => setShowAdjust(true)} className="btn-outline flex items-center gap-2"><AlertTriangle size={16} /> Điều chỉnh kho</button>
          <button onClick={() => setShowPurchase(true)} className="btn-primary flex items-center gap-2"><Plus size={18} /> Nhập hàng</button>
        </div>
      </div>

      <div className="flex gap-2">
        {[['low', 'Hàng sắp hết'], ['logs', 'Lịch sử kho'], ['purchase', 'Phiếu nhập']].map(([val, label]) => (
          <button key={val} onClick={() => setTab(val as any)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === val ? 'bg-blue-600 text-white' : 'bg-white border hover:bg-gray-50'}`}>{label}</button>
        ))}
      </div>

      {tab === 'low' && (
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b"><tr>{['Mã SP', 'Tên sản phẩm', 'Tồn kho', 'Tồn tối thiểu', 'Giá vốn'].map(h => <th key={h} className="px-4 py-3 text-left font-medium text-gray-600">{h}</th>)}</tr></thead>
            <tbody className="divide-y">
              {lowStock?.map((p: any) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{p.code}</td>
                  <td className="px-4 py-3 font-medium">{p.name}</td>
                  <td className="px-4 py-3"><span className={`badge ${p.stock === 0 ? 'badge-red' : 'badge-yellow'}`}>{p.stock} {p.unit}</span></td>
                  <td className="px-4 py-3 text-gray-500">{p.minStock}</td>
                  <td className="px-4 py-3 text-gray-500">{fmt(p.costPrice)}</td>
                </tr>
              ))}
              {!lowStock?.length && <tr><td colSpan={5} className="text-center py-10 text-gray-400">Tất cả sản phẩm đều đủ hàng</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'logs' && (
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b"><tr>{['Sản phẩm', 'Loại', 'Số lượng', 'Trước', 'Sau', 'Ghi chú', 'Thời gian'].map(h => <th key={h} className="px-4 py-3 text-left font-medium text-gray-600">{h}</th>)}</tr></thead>
            <tbody className="divide-y">
              {logs?.map((l: any) => (
                <tr key={l.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">{l.product?.name}</td>
                  <td className="px-4 py-3"><span className={`badge ${logTypeClass[l.type]}`}>{logTypeLabel[l.type]}</span></td>
                  <td className="px-4 py-3 font-semibold">{l.qty}</td>
                  <td className="px-4 py-3 text-gray-500">{l.before}</td>
                  <td className="px-4 py-3 text-gray-500">{l.after}</td>
                  <td className="px-4 py-3 text-gray-400">{l.note || '-'}</td>
                  <td className="px-4 py-3 text-gray-400">{new Date(l.createdAt).toLocaleString('vi-VN')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'purchase' && (
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b"><tr>{['Mã phiếu', 'Nhà cung cấp', 'Tổng tiền', 'Đã trả', 'Còn nợ', 'Ngày nhập'].map(h => <th key={h} className="px-4 py-3 text-left font-medium text-gray-600">{h}</th>)}</tr></thead>
            <tbody className="divide-y">
              {purchases?.data?.map((p: any) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs font-semibold">{p.code}</td>
                  <td className="px-4 py-3">{p.supplier?.name}</td>
                  <td className="px-4 py-3 font-semibold">{fmt(p.total)}</td>
                  <td className="px-4 py-3 text-green-600">{fmt(p.paid)}</td>
                  <td className="px-4 py-3 text-red-500">{fmt(p.debt)}</td>
                  <td className="px-4 py-3 text-gray-400">{new Date(p.createdAt).toLocaleDateString('vi-VN')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Adjust modal */}
      {showAdjust && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold mb-4">Điều chỉnh tồn kho</h2>
            <form onSubmit={e => { e.preventDefault(); adjust.mutate(adjustForm) }} className="space-y-3">
              <div><label className="block text-sm font-medium mb-1">Sản phẩm *</label>
                <select className="input" value={adjustForm.productId} onChange={e => setAdjustForm(p => ({ ...p, productId: e.target.value }))} required>
                  <option value="">-- Chọn sản phẩm --</option>
                  {products?.map((p: any) => <option key={p.id} value={p.id}>{p.name} (Tồn: {p.stock})</option>)}
                </select>
              </div>
              <div><label className="block text-sm font-medium mb-1">Tồn kho thực tế *</label><input className="input" type="number" min="0" value={adjustForm.newStock} onChange={e => setAdjustForm(p => ({ ...p, newStock: +e.target.value }))} required /></div>
              <div><label className="block text-sm font-medium mb-1">Ghi chú</label><input className="input" value={adjustForm.note} onChange={e => setAdjustForm(p => ({ ...p, note: e.target.value }))} /></div>
              <div className="flex gap-3 justify-end pt-2">
                <button type="button" onClick={() => setShowAdjust(false)} className="btn-outline">Hủy</button>
                <button type="submit" disabled={adjust.isPending} className="btn-primary">{adjust.isPending ? 'Đang lưu...' : 'Lưu'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Purchase modal */}
      {showPurchase && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold mb-4">Phiếu nhập hàng</h2>
            <form onSubmit={e => { e.preventDefault(); purchase.mutate(purchaseForm) }} className="space-y-4">
              <div><label className="block text-sm font-medium mb-1">Nhà cung cấp *</label>
                <select className="input" value={purchaseForm.supplierId} onChange={e => setPurchaseForm(p => ({ ...p, supplierId: e.target.value }))} required>
                  <option value="">-- Chọn NCC --</option>
                  {suppliers?.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <div className="flex justify-between items-center mb-2"><label className="text-sm font-medium">Sản phẩm nhập</label><button type="button" onClick={addPurchaseItem} className="text-blue-600 text-sm">+ Thêm dòng</button></div>
                {purchaseForm.items.map((item, i) => (
                  <div key={i} className="grid grid-cols-3 gap-2 mb-2">
                    <select className="input col-span-1" value={item.productId} onChange={e => updatePurchaseItem(i, 'productId', e.target.value)} required>
                      <option value="">-- Sản phẩm --</option>
                      {products?.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <input className="input" type="number" min="1" placeholder="Số lượng" value={item.qty} onChange={e => updatePurchaseItem(i, 'qty', +e.target.value)} required />
                    <input className="input" type="number" min="0" placeholder="Giá nhập" value={item.costPrice} onChange={e => updatePurchaseItem(i, 'costPrice', +e.target.value)} required />
                  </div>
                ))}
              </div>
              <div><label className="block text-sm font-medium mb-1">Đã trả</label><input className="input" type="number" min="0" value={purchaseForm.paid} onChange={e => setPurchaseForm(p => ({ ...p, paid: +e.target.value }))} /></div>
              <div><label className="block text-sm font-medium mb-1">Ghi chú</label><input className="input" value={purchaseForm.note} onChange={e => setPurchaseForm(p => ({ ...p, note: e.target.value }))} /></div>
              <div className="flex gap-3 justify-end pt-2">
                <button type="button" onClick={() => setShowPurchase(false)} className="btn-outline">Hủy</button>
                <button type="submit" disabled={purchase.isPending} className="btn-primary">{purchase.isPending ? 'Đang lưu...' : 'Nhập hàng'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

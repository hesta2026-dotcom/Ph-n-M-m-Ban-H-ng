import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../../services/api'
import toast from 'react-hot-toast'
import { X, TrendingUp, TrendingDown, RefreshCw } from 'lucide-react'

interface Props {
  product: any
  onClose: () => void
}

const TYPES = [
  { value: 'ADJUST_ADD',    label: 'Nhập thêm',       icon: TrendingUp,   color: 'text-green-600', bg: 'bg-green-50 border-green-300' },
  { value: 'ADJUST_REMOVE', label: 'Xuất / bỏ',        icon: TrendingDown, color: 'text-red-600',   bg: 'bg-red-50 border-red-300' },
  { value: 'ADJUST_SET',    label: 'Kiểm kho (đặt về)', icon: RefreshCw,    color: 'text-blue-600',  bg: 'bg-blue-50 border-blue-300' },
]

export default function StockAdjustModal({ product, onClose }: Props) {
  const qc = useQueryClient()
  const pQty = product.packageQty || 0

  const [type, setType] = useState<'ADJUST_ADD' | 'ADJUST_REMOVE' | 'ADJUST_SET'>('ADJUST_ADD')
  const [boxes, setBoxes] = useState(0)
  const [rem, setRem] = useState(0)
  const [note, setNote] = useState('')

  const totalQty = pQty > 0 ? boxes * pQty + rem : rem

  const previewAfter = () => {
    if (type === 'ADJUST_SET') return totalQty
    if (type === 'ADJUST_ADD') return product.stock + totalQty
    return product.stock - totalQty
  }
  const after = previewAfter()
  const invalid = type === 'ADJUST_REMOVE' && after < 0

  const adjust = useMutation({
    mutationFn: () => api.patch(`/products/${product.id}/stock`, { type, qty: totalQty, note }),
    onSuccess: () => {
      toast.success('Đã cập nhật tồn kho')
      qc.invalidateQueries({ queryKey: ['products'] })
      qc.invalidateQueries({ queryKey: ['products-all'] })
      onClose()
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Lỗi điều chỉnh tồn kho')
  })

  const currentBoxes = pQty > 0 ? Math.floor(product.stock / pQty) : 0
  const currentRem = pQty > 0 ? product.stock % pQty : product.stock

  return (
    <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold">Điều chỉnh tồn kho</h2>
            <p className="text-sm text-gray-500 truncate max-w-xs">{product.name}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>

        <div className="p-6 space-y-5">
          {/* Tồn kho hiện tại */}
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Tồn kho hiện tại</p>
            <div className="flex items-baseline gap-3">
              {pQty > 0 ? (
                <>
                  <span className="text-2xl font-bold text-gray-800">{currentBoxes}</span>
                  <span className="text-sm text-gray-500">{product.packageUnit}</span>
                  <span className="text-gray-300">+</span>
                  <span className="text-2xl font-bold text-gray-800">{currentRem}</span>
                  <span className="text-sm text-gray-500">{product.unit}</span>
                  <span className="text-xs text-gray-400 ml-1">(= {product.stock} {product.unit})</span>
                </>
              ) : (
                <>
                  <span className="text-2xl font-bold text-gray-800">{product.stock}</span>
                  <span className="text-sm text-gray-500">{product.unit}</span>
                </>
              )}
            </div>
          </div>

          {/* Loại điều chỉnh */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Loại điều chỉnh</p>
            <div className="grid grid-cols-3 gap-2">
              {TYPES.map(t => {
                const Icon = t.icon
                return (
                  <button key={t.value} type="button"
                    onClick={() => setType(t.value as any)}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 text-xs font-medium transition-all
                      ${type === t.value ? `${t.bg} ${t.color}` : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                    <Icon size={18} />
                    {t.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Số lượng */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">
              {type === 'ADJUST_SET' ? 'Tồn kho mới' : 'Số lượng'}
            </p>
            {pQty > 0 ? (
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <input className="input text-right text-lg font-semibold" type="number" min={0} value={boxes || ''}
                    onChange={e => setBoxes(+e.target.value || 0)} placeholder="0" />
                  <p className="text-xs text-gray-400 mt-1 text-center">{product.packageUnit} (×{pQty})</p>
                </div>
                <span className="text-gray-400 font-bold text-lg">+</span>
                <div className="flex-1">
                  <input className="input text-right text-lg font-semibold" type="number" min={0} value={rem || ''}
                    onChange={e => setRem(+e.target.value || 0)} placeholder="0" />
                  <p className="text-xs text-gray-400 mt-1 text-center">{product.unit} (lẻ)</p>
                </div>
                <span className="text-gray-300">=</span>
                <div className="text-right min-w-[3rem]">
                  <p className="text-lg font-bold text-gray-700">{totalQty}</p>
                  <p className="text-xs text-gray-400">{product.unit}</p>
                </div>
              </div>
            ) : (
              <input className="input text-right text-lg font-semibold" type="number" min={0} value={rem || ''}
                onChange={e => setRem(+e.target.value || 0)} placeholder="0" />
            )}
          </div>

          {/* Preview */}
          <div className={`rounded-xl p-4 border-2 transition-colors ${
            invalid ? 'bg-red-50 border-red-300' :
            type === 'ADJUST_ADD' ? 'bg-green-50 border-green-200' :
            type === 'ADJUST_REMOVE' ? 'bg-orange-50 border-orange-200' :
            'bg-blue-50 border-blue-200'
          }`}>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Sau điều chỉnh</p>
            {invalid ? (
              <p className="text-red-600 font-semibold">Tồn kho không đủ (thiếu {-after} {product.unit})</p>
            ) : (
              <div className="flex items-baseline gap-2">
                {pQty > 0 ? (
                  <>
                    <span className="text-xl font-bold">{Math.floor(after / pQty)}</span>
                    <span className="text-sm text-gray-500">{product.packageUnit}</span>
                    <span className="text-gray-300">+</span>
                    <span className="text-xl font-bold">{after % pQty}</span>
                    <span className="text-sm text-gray-500">{product.unit}</span>
                    <span className="text-xs text-gray-400 ml-1">(= {after} {product.unit})</span>
                  </>
                ) : (
                  <>
                    <span className="text-xl font-bold">{after}</span>
                    <span className="text-sm text-gray-500">{product.unit}</span>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Ghi chú */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Ghi chú</label>
            <input className="input" value={note} onChange={e => setNote(e.target.value)}
              placeholder="Lý do điều chỉnh..." />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2 border-t">
            <button type="button" onClick={onClose} className="btn-outline flex-1">Hủy</button>
            <button
              onClick={() => adjust.mutate()}
              disabled={adjust.isPending || invalid || totalQty === 0}
              className="btn-primary flex-1 disabled:opacity-50">
              {adjust.isPending ? 'Đang lưu...' : 'Xác nhận'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

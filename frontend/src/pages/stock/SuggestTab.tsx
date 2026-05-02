import { useState } from 'react'
import { ShoppingCart, AlertTriangle, Clock, TrendingDown, CheckSquare, Square } from 'lucide-react'

const fmt = (n: number) => new Intl.NumberFormat('vi-VN').format(n) + 'đ'
const fmtNum = (n: number) => new Intl.NumberFormat('vi-VN').format(n)

interface SuggestItem {
  id: string
  name: string
  code: string
  unit: string
  packageUnit: string | null
  packageQty: number | null
  stock: number
  minStock: number
  costPrice: number
  supplierId: string | null
  supplierName: string | null
  dailyAvg: number
  totalSold: number
  daysRemaining: number
  targetStock: number
  suggestedQty: number
  suggestedBoxes: number | null
  suggestedRem: number
}

interface Props {
  suggestions: SuggestItem[] | undefined
  suggestLoading: boolean
  onCreatePurchase: (items: SuggestItem[]) => void
}

function urgency(days: number): 'critical' | 'warning' | 'ok' {
  if (days <= 3) return 'critical'
  if (days <= 7) return 'warning'
  return 'ok'
}

export default function SuggestTab({ suggestions, suggestLoading, onCreatePurchase }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const toggle = (id: string) => setSelected(prev => {
    const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s
  })
  const toggleAll = () => {
    if (!suggestions) return
    if (selected.size === suggestions.length) setSelected(new Set())
    else setSelected(new Set(suggestions.map(s => s.id)))
  }

  if (suggestLoading) return (
    <div className="flex items-center justify-center py-20 text-gray-400">Đang phân tích dữ liệu...</div>
  )
  if (!suggestions) return null

  const critical = suggestions.filter(s => urgency(s.daysRemaining) === 'critical')
  const warning = suggestions.filter(s => urgency(s.daysRemaining) === 'warning')
  const totalValue = suggestions.reduce((acc, s) => acc + s.suggestedQty * s.costPrice, 0)
  const selectedItems = suggestions.filter(s => selected.has(s.id))

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="card p-4">
          <p className="text-xs text-gray-500 mb-1">Cần nhập hàng</p>
          <p className="text-2xl font-bold text-gray-800">{suggestions.length}</p>
          <p className="text-xs text-gray-400">sản phẩm</p>
        </div>
        <div className="card p-4 border-red-100">
          <p className="text-xs text-red-500 mb-1 flex items-center gap-1"><AlertTriangle size={11} /> Khẩn cấp (≤3 ngày)</p>
          <p className="text-2xl font-bold text-red-600">{critical.length}</p>
          <p className="text-xs text-gray-400">sản phẩm</p>
        </div>
        <div className="card p-4 border-yellow-100">
          <p className="text-xs text-yellow-600 mb-1 flex items-center gap-1"><Clock size={11} /> Sắp hết (≤7 ngày)</p>
          <p className="text-2xl font-bold text-yellow-600">{warning.length}</p>
          <p className="text-xs text-gray-400">sản phẩm</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500 mb-1">Giá trị cần nhập</p>
          <p className="text-xl font-bold text-purple-600">{fmt(totalValue)}</p>
          <p className="text-xs text-gray-400">theo giá vốn</p>
        </div>
      </div>

      {/* Toolbar */}
      {suggestions.length > 0 && (
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={toggleAll}
            className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-800">
            {selected.size === suggestions.length
              ? <CheckSquare size={16} className="text-blue-600" />
              : <Square size={16} />}
            {selected.size > 0 ? `Đã chọn ${selected.size}` : 'Chọn tất cả'}
          </button>
          {selected.size > 0 && (
            <button
              onClick={() => onCreatePurchase(selectedItems)}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">
              <ShoppingCart size={15} />
              Tạo phiếu nhập ({selected.size} sản phẩm)
            </button>
          )}
          <span className="text-xs text-gray-400 ml-auto">
            Dựa trên dữ liệu bán hàng 30 ngày gần nhất · Tồn kho chuẩn = 10 ngày bán
          </span>
        </div>
      )}

      {suggestions.length === 0 ? (
        <div className="card p-12 text-center">
          <TrendingDown size={40} className="mx-auto text-green-400 mb-3" />
          <p className="font-semibold text-gray-600">Tất cả sản phẩm đều đủ hàng cho 10 ngày tới</p>
          <p className="text-sm text-gray-400 mt-1">Không có sản phẩm nào cần nhập thêm</p>
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-3 py-3 w-10"></th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Sản phẩm</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Nhà cung cấp</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">TB ngày (30 ngày)</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">Tồn hiện tại</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">Còn đủ</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">Cần nhập</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">Giá trị nhập</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {suggestions.map(s => {
                  const u = urgency(s.daysRemaining)
                  const checked = selected.has(s.id)
                  return (
                    <tr key={s.id} onClick={() => toggle(s.id)}
                      className={`cursor-pointer transition-colors ${checked ? 'bg-blue-50' : u === 'critical' ? 'bg-red-50/40 hover:bg-red-50' : u === 'warning' ? 'bg-yellow-50/40 hover:bg-yellow-50' : 'hover:bg-gray-50'}`}>
                      <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                        <input type="checkbox" className="w-4 h-4 rounded cursor-pointer accent-blue-600"
                          checked={checked} onChange={() => toggle(s.id)} />
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium">{s.name}</p>
                        <p className="text-xs text-gray-400 font-mono">{s.code}</p>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-sm">
                        {s.supplierName || <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {s.dailyAvg > 0
                          ? <span className="font-medium">{fmtNum(s.dailyAvg)} <span className="text-xs text-gray-400">{s.unit}</span></span>
                          : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-semibold">{fmtNum(s.stock)}</span>
                        <span className="text-xs text-gray-400 ml-1">{s.unit}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {s.dailyAvg > 0 ? (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                            u === 'critical' ? 'bg-red-100 text-red-700' :
                            u === 'warning' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-green-100 text-green-700'}`}>
                            {u === 'critical' && <AlertTriangle size={10} />}
                            {s.daysRemaining === 0 ? 'Hết hàng' : `${s.daysRemaining} ngày`}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">Tồn thấp</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <p className="font-bold text-blue-700">{fmtNum(s.suggestedQty)} <span className="text-xs font-normal text-gray-400">{s.unit}</span></p>
                        {s.packageQty && s.suggestedBoxes !== null && s.suggestedBoxes > 0 && (
                          <p className="text-xs text-gray-400">{s.suggestedBoxes} {s.packageUnit} + {s.suggestedRem} {s.unit}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-purple-600 font-medium whitespace-nowrap">
                        {fmt(s.suggestedQty * s.costPrice)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot className="bg-gray-50 border-t font-semibold text-sm">
                <tr>
                  <td colSpan={6} className="px-4 py-3 text-gray-600">
                    Tổng ({suggestions.length} sản phẩm)
                  </td>
                  <td className="px-4 py-3 text-right text-blue-700">
                    {fmtNum(suggestions.reduce((a, s) => a + s.suggestedQty, 0))} đơn vị
                  </td>
                  <td className="px-4 py-3 text-right text-purple-600">
                    {fmt(totalValue)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

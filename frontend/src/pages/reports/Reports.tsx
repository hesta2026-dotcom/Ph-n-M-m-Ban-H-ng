import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '../../services/api'
import { BarChart2, TrendingUp, FileSpreadsheet, FileText } from 'lucide-react'
import { exportExcel, exportPDF, PRESETS, fmtPeriod } from '../../utils/export'
import ColumnPicker, { ColDef } from '../../components/ColumnPicker'

const fmt = (n: number) => new Intl.NumberFormat('vi-VN').format(n) + 'đ'

const COLS_REVENUE: ColDef[] = [
  { key: 'orderCode', label: 'Mã đơn' },
  { key: 'customer', label: 'Khách hàng' },
  { key: 'phone', label: 'SĐT' },
  { key: 'staff', label: 'Nhân viên' },
  { key: 'channel', label: 'Kênh' },
  { key: 'paymentMethod', label: 'Thanh toán' },
  { key: 'items', label: 'Sản phẩm' },
  { key: 'subtotal', label: 'Tạm tính' },
  { key: 'discount', label: 'Giảm giá' },
  { key: 'total', label: 'Tổng tiền' },
  { key: 'amountPaid', label: 'Tiền nhận' },
  { key: 'createdAt', label: 'Ngày giờ' },
]

const PAY_LABEL: any = { CASH: 'Tiền mặt', CARD: 'Thẻ', TRANSFER: 'CK', DEBT: 'Ghi nợ', MIXED: 'Hỗn hợp' }

export default function Reports() {
  const _now = new Date()
  const _ld = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const [from, setFrom] = useState(_ld(new Date(_now.getFullYear(), _now.getMonth(), 1)))
  const [to, setTo] = useState(_ld(_now))
  const [activePreset, setActivePreset] = useState('Tháng này')
  const [visible, setVisible] = useState<Set<string>>(() => new Set(COLS_REVENUE.map(c => c.key)))

  const applyPreset = (p: typeof PRESETS[number]) => {
    const [f, t] = p.getDates(); setFrom(f); setTo(t); setActivePreset(p.label)
  }

  const { data: revenue } = useQuery({
    queryKey: ['revenue', from, to],
    queryFn: () => api.get(`/reports/revenue?from=${from}&to=${to}`).then(r => r.data)
  })
  const { data: topProducts } = useQuery({
    queryKey: ['top-products', from, to],
    queryFn: () => api.get(`/reports/top-products?from=${from}&to=${to}&limit=10`).then(r => r.data)
  })
  const { data: cashflow } = useQuery({
    queryKey: ['cashflow-report', from, to],
    queryFn: () => api.get(`/reports/cashflow?from=${from}&to=${to}`).then(r => r.data)
  })

  const totalRevenue = revenue?.reduce((s: number, o: any) => s + o.total, 0) || 0
  const totalOrders = revenue?.length || 0
  const byChannel = revenue?.reduce((acc: any, o: any) => { acc[o.channel] = (acc[o.channel] || 0) + o.total; return acc }, {}) || {}
  const channelLabel: any = { store: 'Cửa hàng', shopee: 'Shopee', facebook: 'Facebook', web: 'Website' }

  const visCols = COLS_REVENUE.filter(c => visible.has(c.key))

  const getVal = (o: any, key: string) => {
    switch (key) {
      case 'orderCode': return o.orderCode
      case 'customer': return o.customer?.name || 'Khách lẻ'
      case 'phone': return o.customer?.phone || '—'
      case 'staff': return o.user?.name || '—'
      case 'channel': return channelLabel[o.channel] || o.channel
      case 'paymentMethod': return PAY_LABEL[o.paymentMethod] || o.paymentMethod
      case 'items': return (o.items || []).map((i: any) => `${i.product?.name} x${i.qty}`).join(', ')
      case 'subtotal': return o.subtotal
      case 'discount': return o.discount || 0
      case 'total': return o.total
      case 'amountPaid': return o.amountPaid || 0
      case 'createdAt': return new Date(o.createdAt).toLocaleString('vi-VN')
      default: return ''
    }
  }

  const handleExcelRevenue = () => {
    const headers = visCols.map(c => c.label)
    const rows = (revenue || []).map((o: any) => visCols.map(c => getVal(o, c.key)))
    exportExcel(`Doanh-thu_${from}_${to}`, 'Doanh thu', headers, rows)
  }

  const handlePDFRevenue = () => {
    const headers = visCols.map(c => c.label)
    const rows = (revenue || []).map((o: any) => visCols.map(c =>
      c.key === 'total' ? fmt(o.total) : getVal(o, c.key)
    ))
    exportPDF(`Doanh-thu_${from}_${to}`, 'Báo cáo doanh thu', fmtPeriod(from, to), headers, rows)
  }

  const handleExcelProducts = () => {
    const headers = ['#', 'Sản phẩm', 'Mã SP', 'Số lượng bán', 'Doanh thu']
    const rows = (topProducts || []).map((item: any, i: number) => [i + 1, item.product?.name, item.product?.code, item._sum.qty, item._sum.total || 0])
    exportExcel(`Top-san-pham_${from}_${to}`, 'Top sản phẩm', headers, rows)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold">Báo cáo</h1>
      </div>

      <div className="card py-4">
        <div className="flex items-center flex-wrap gap-3">
          <div className="flex gap-1.5 flex-wrap">
            {PRESETS.map(p => (
              <button key={p.label} onClick={() => applyPreset(p)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${activePreset === p.label ? 'bg-blue-600 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}>
                {p.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 ml-auto flex-wrap">
            <span className="text-sm text-gray-500">Từ:</span>
            <input type="date" className="input text-sm py-1.5 w-38" value={from} onChange={e => { setFrom(e.target.value); setActivePreset('') }} />
            <span className="text-sm text-gray-500">Đến:</span>
            <input type="date" className="input text-sm py-1.5 w-38" value={to} onChange={e => { setTo(e.target.value); setActivePreset('') }} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Doanh thu', value: fmt(totalRevenue), icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Số đơn hàng', value: totalOrders, icon: BarChart2, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Tổng thu', value: fmt(cashflow?.income || 0), icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Tổng chi', value: fmt(cashflow?.expense || 0), icon: TrendingUp, color: 'text-red-600', bg: 'bg-red-50' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="card flex items-center gap-3">
            <div className={`${bg} p-3 rounded-xl`}><Icon size={22} className={color} /></div>
            <div><p className={`text-xl font-bold ${color}`}>{value}</p><p className="text-xs text-gray-500">{label}</p></div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="font-semibold mb-4 flex items-center gap-2"><BarChart2 size={18} /> Doanh thu theo kênh</h2>
          <div className="space-y-3">
            {Object.entries(byChannel).map(([channel, amount]: any) => {
              const pct = totalRevenue ? (amount / totalRevenue * 100).toFixed(1) : 0
              return (
                <div key={channel}>
                  <div className="flex justify-between text-sm mb-1"><span className="font-medium">{channelLabel[channel] || channel}</span><span className="text-gray-500">{fmt(amount)} ({pct}%)</span></div>
                  <div className="h-2 bg-gray-100 rounded-full"><div className="h-2 bg-blue-500 rounded-full" style={{ width: `${pct}%` }} /></div>
                </div>
              )
            })}
            {!Object.keys(byChannel).length && <p className="text-gray-400 text-sm">Không có dữ liệu</p>}
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold flex items-center gap-2"><BarChart2 size={18} /> Top sản phẩm bán chạy</h2>
            <button onClick={handleExcelProducts} title="Xuất Excel" className="text-green-600 hover:text-green-700">
              <FileSpreadsheet size={18} />
            </button>
          </div>
          <div className="space-y-2">
            {topProducts?.map((item: any, idx: number) => (
              <div key={item.productId} className="flex items-center gap-3 text-sm">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${idx < 3 ? 'bg-yellow-400 text-yellow-900' : 'bg-gray-100 text-gray-600'}`}>{idx + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{item.product?.name}</p>
                  <p className="text-gray-400">SL: {item._sum.qty} | {fmt(item._sum.total || 0)}</p>
                </div>
              </div>
            ))}
            {!topProducts?.length && <p className="text-gray-400 text-sm">Không có dữ liệu</p>}
          </div>
        </div>
      </div>

      {(revenue?.length > 0) && (
        <div className="card p-0 overflow-hidden">
          <div className="px-5 py-4 border-b flex items-center justify-between flex-wrap gap-2">
            <h2 className="font-semibold text-gray-800">Danh sách đơn hàng ({revenue.length})</h2>
            <div className="flex gap-2 items-center">
              <ColumnPicker cols={COLS_REVENUE} visible={visible} onChange={setVisible} />
              <button onClick={handleExcelRevenue} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-medium hover:bg-green-700">
                <FileSpreadsheet size={14} /> Excel
              </button>
              <button onClick={handlePDFRevenue} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-medium hover:bg-red-700">
                <FileText size={14} /> PDF
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {visCols.map(c => (
                    <th key={c.key} className="px-4 py-3 text-left font-medium text-gray-600">{c.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {revenue.map((o: any) => (
                  <tr key={o.id} className="hover:bg-gray-50">
                    {visible.has('orderCode') && <td className="px-4 py-2.5 font-mono text-xs font-semibold text-blue-700">{o.orderCode}</td>}
                    {visible.has('customer') && <td className="px-4 py-2.5">{o.customer?.name || 'Khách lẻ'}</td>}
                    {visible.has('channel') && <td className="px-4 py-2.5 text-gray-500">{channelLabel[o.channel] || o.channel}</td>}
                    {visible.has('total') && <td className="px-4 py-2.5 font-semibold text-green-600">{fmt(o.total)}</td>}
                    {visible.has('createdAt') && <td className="px-4 py-2.5 text-gray-400 text-xs">{new Date(o.createdAt).toLocaleDateString('vi-VN')}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

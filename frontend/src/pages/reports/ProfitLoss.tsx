import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend } from 'chart.js'
import { Bar } from 'react-chartjs-2'
import api from '../../services/api'
import { TrendingUp, TrendingDown, DollarSign, ShoppingBag, Activity, Percent, FileSpreadsheet, FileText } from 'lucide-react'
import { exportExcel, exportPDF, PRESETS, fmtPeriod } from '../../utils/export'
import ColumnPicker, { ColDef } from '../../components/ColumnPicker'

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend)

const fmt = (n: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(n)
const fmtShort = (n: number) => {
  if (Math.abs(n) >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + 'B'
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (Math.abs(n) >= 1_000) return (n / 1_000).toFixed(0) + 'K'
  return n.toString()
}

function StatCard({ label, value, sub, icon: Icon, colorClass, bgClass, isProfit }: any) {
  return (
    <div className={`card flex items-start gap-4 ${isProfit !== undefined ? (isProfit ? 'border-l-4 border-green-400' : 'border-l-4 border-red-400') : ''}`}>
      <div className={`${bgClass} p-3 rounded-xl flex-shrink-0`}><Icon size={22} className={colorClass} /></div>
      <div className="min-w-0">
        <p className={`text-xl font-bold truncate ${colorClass}`}>{value}</p>
        <p className="text-xs text-gray-500 mt-0.5">{label}</p>
        {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
      </div>
    </div>
  )
}

const COLS_DAILY: ColDef[] = [
  { key: 'date', label: 'Ngày' },
  { key: 'revenue', label: 'Doanh thu' },
  { key: 'cogs', label: 'Giá vốn' },
  { key: 'grossProfit', label: 'Lợi nhuận gộp' },
  { key: 'grossMargin', label: 'Biên lợi nhuận' },
]

export default function ProfitLoss() {
  const now = new Date()
  const _ld = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const [from, setFrom] = useState(_ld(new Date(now.getFullYear(), now.getMonth(), 1)))
  const [to, setTo] = useState(_ld(now))
  const [activePreset, setActivePreset] = useState('Tháng này')
  const [visible, setVisible] = useState<Set<string>>(() => new Set(COLS_DAILY.map(c => c.key)))

  const applyPreset = (preset: typeof PRESETS[number]) => {
    const [f, t] = preset.getDates(); setFrom(f); setTo(t); setActivePreset(preset.label)
  }

  const { data, isLoading } = useQuery({
    queryKey: ['profit-loss', from, to],
    queryFn: () => api.get(`/reports/profit-loss?from=${from}&to=${to}`).then(r => r.data)
  })

  const d = data || { revenue: 0, cogs: 0, grossProfit: 0, expenses: 0, otherIncome: 0, netProfit: 0, grossMargin: 0, netMargin: 0, daily: [] }

  const chartData = {
    labels: d.daily.map((x: any) => x.date.slice(5)),
    datasets: [
      { label: 'Doanh thu', data: d.daily.map((x: any) => x.revenue), backgroundColor: 'rgba(59,130,246,0.7)', borderRadius: 4 },
      { label: 'Giá vốn', data: d.daily.map((x: any) => x.cogs), backgroundColor: 'rgba(239,68,68,0.6)', borderRadius: 4 },
      { label: 'Lợi nhuận gộp', data: d.daily.map((x: any) => x.grossProfit), backgroundColor: 'rgba(34,197,94,0.7)', borderRadius: 4 },
    ]
  }

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: { position: 'top' as const },
      tooltip: { callbacks: { label: (ctx: any) => ` ${ctx.dataset.label}: ${fmtShort(ctx.raw)}đ` } }
    },
    scales: { y: { ticks: { callback: (v: any) => fmtShort(v) + 'đ' } } }
  }

  const visCols = COLS_DAILY.filter(c => visible.has(c.key))

  const handleExcelDaily = () => {
    const headers = visCols.map(c => c.label)
    const rows = d.daily.map((row: any) => {
      const margin = row.revenue ? (row.grossProfit / row.revenue * 100).toFixed(1) : '0'
      return visCols.map(c => {
        switch (c.key) {
          case 'date': return row.date
          case 'revenue': return row.revenue
          case 'cogs': return row.cogs
          case 'grossProfit': return row.grossProfit
          case 'grossMargin': return margin + '%'
          default: return ''
        }
      })
    })
    exportExcel(`Lai-lo_${from}_${to}`, 'Chi tiết ngày', headers, rows)
  }

  const handlePDF = () => {
    const headers = visCols.map(c => c.label)
    const rows = d.daily.map((row: any) => {
      const margin = row.revenue ? (row.grossProfit / row.revenue * 100).toFixed(1) : '0'
      return visCols.map(c => {
        switch (c.key) {
          case 'date': return row.date
          case 'revenue': return fmt(row.revenue)
          case 'cogs': return fmt(row.cogs)
          case 'grossProfit': return fmt(row.grossProfit)
          case 'grossMargin': return margin + '%'
          default: return ''
        }
      })
    })
    const summaryRows: any[] = [
      ['Doanh thu', fmt(d.revenue), '', '', ''].slice(0, visCols.length),
      ['Giá vốn', fmt(d.cogs), '', '', ''].slice(0, visCols.length),
      ['LN gộp', fmt(d.grossProfit), '', '', d.grossMargin.toFixed(1) + '%'].slice(0, visCols.length),
      ['Chi phí', fmt(d.expenses), '', '', ''].slice(0, visCols.length),
      ['LN ròng', fmt(d.netProfit), '', '', d.netMargin.toFixed(1) + '%'].slice(0, visCols.length),
      ['---Chi tiết theo ngày---', ...Array(visCols.length - 1).fill('')],
      ...rows
    ]
    exportPDF(`Lai-lo_${from}_${to}`, 'Báo cáo Lãi / Lỗ', fmtPeriod(from, to), headers, summaryRows)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Báo cáo Lãi / Lỗ</h1>
          <p className="text-sm text-gray-500 mt-0.5">Phân tích doanh thu, chi phí và lợi nhuận</p>
        </div>
        <div className="flex gap-2 items-center">
          <ColumnPicker cols={COLS_DAILY} visible={visible} onChange={setVisible} />
          <button onClick={handleExcelDaily} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700">
            <FileSpreadsheet size={15} /> Excel
          </button>
          <button onClick={handlePDF} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700">
            <FileText size={15} /> PDF
          </button>
        </div>
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

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <StatCard label="Doanh thu" value={fmt(d.revenue)} icon={TrendingUp} colorClass="text-blue-600" bgClass="bg-blue-50" />
            <StatCard label="Giá vốn hàng bán" value={fmt(d.cogs)} sub={`${d.revenue ? ((d.cogs/d.revenue)*100).toFixed(1) : 0}% doanh thu`} icon={ShoppingBag} colorClass="text-orange-600" bgClass="bg-orange-50" />
            <StatCard label="Lợi nhuận gộp" value={fmt(d.grossProfit)} sub={`Biên lợi nhuận gộp: ${d.grossMargin.toFixed(1)}%`} icon={DollarSign} colorClass={d.grossProfit >= 0 ? 'text-green-600' : 'text-red-600'} bgClass={d.grossProfit >= 0 ? 'bg-green-50' : 'bg-red-50'} isProfit={d.grossProfit >= 0} />
            <StatCard label="Chi phí hoạt động" value={fmt(d.expenses)} icon={TrendingDown} colorClass="text-red-600" bgClass="bg-red-50" />
            <StatCard label="Thu nhập khác" value={fmt(d.otherIncome)} icon={Activity} colorClass="text-purple-600" bgClass="bg-purple-50" />
            <StatCard label="Lợi nhuận ròng" value={fmt(d.netProfit)} sub={`Biên lợi nhuận ròng: ${d.netMargin.toFixed(1)}%`} icon={Percent} colorClass={d.netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'} bgClass={d.netProfit >= 0 ? 'bg-emerald-50' : 'bg-red-50'} isProfit={d.netProfit >= 0} />
          </div>

          <div className="card">
            <h2 className="font-semibold text-gray-800 mb-4">Bảng kết quả kinh doanh</h2>
            <div className="space-y-2 text-sm">
              {[
                { label: 'Doanh thu bán hàng', value: d.revenue, bold: false, indent: false },
                { label: 'Giá vốn hàng bán', value: -d.cogs, bold: false, indent: true },
                { label: 'Lợi nhuận gộp', value: d.grossProfit, bold: true, indent: false, border: true },
                { label: 'Thu nhập khác', value: d.otherIncome, bold: false, indent: true },
                { label: 'Chi phí hoạt động', value: -d.expenses, bold: false, indent: true },
                { label: 'Lợi nhuận ròng', value: d.netProfit, bold: true, indent: false, border: true, highlight: true },
              ].map(row => (
                <div key={row.label} className={`flex justify-between items-center py-2 ${row.border ? 'border-t border-gray-200 mt-1' : ''} ${row.highlight ? 'bg-gray-50 rounded-lg px-3 -mx-3' : row.indent ? 'pl-6 text-gray-500' : ''}`}>
                  <span className={row.bold ? 'font-semibold text-gray-900' : ''}>{row.label}</span>
                  <span className={`font-${row.bold ? 'bold' : 'medium'} ${row.value >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
                    {row.value < 0 ? `(${fmt(Math.abs(row.value))})` : fmt(row.value)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {d.daily.length > 0 ? (
            <div className="card">
              <h2 className="font-semibold text-gray-800 mb-4">Biểu đồ theo ngày</h2>
              <Bar data={chartData} options={chartOptions} />
            </div>
          ) : (
            <div className="card text-center py-12 text-gray-400">Không có dữ liệu trong khoảng thời gian này</div>
          )}

          {d.daily.length > 0 && (
            <div className="card p-0 overflow-hidden">
              <div className="px-6 py-4 border-b">
                <h2 className="font-semibold text-gray-800">Chi tiết theo ngày</h2>
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
                  <tbody className="divide-y divide-gray-100">
                    {d.daily.map((row: any) => {
                      const margin = row.revenue ? (row.grossProfit / row.revenue * 100) : 0
                      return (
                        <tr key={row.date} className="hover:bg-gray-50">
                          {visible.has('date') && <td className="px-4 py-3 font-medium text-gray-700">{row.date}</td>}
                          {visible.has('revenue') && <td className="px-4 py-3 text-blue-600">{fmt(row.revenue)}</td>}
                          {visible.has('cogs') && <td className="px-4 py-3 text-orange-600">{fmt(row.cogs)}</td>}
                          {visible.has('grossProfit') && <td className={`px-4 py-3 font-medium ${row.grossProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fmt(row.grossProfit)}</td>}
                          {visible.has('grossMargin') && (
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-2 bg-gray-100 rounded-full">
                                  <div className={`h-2 rounded-full ${margin >= 0 ? 'bg-green-400' : 'bg-red-400'}`} style={{ width: `${Math.min(Math.abs(margin), 100)}%` }} />
                                </div>
                                <span className={`text-xs font-medium ${margin >= 0 ? 'text-green-600' : 'text-red-600'}`}>{margin.toFixed(1)}%</span>
                              </div>
                            </td>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot className="bg-gray-50 font-semibold">
                    <tr>
                      {visible.has('date') && <td className="px-4 py-3">Tổng cộng</td>}
                      {visible.has('revenue') && <td className="px-4 py-3 text-blue-600">{fmt(d.revenue)}</td>}
                      {visible.has('cogs') && <td className="px-4 py-3 text-orange-600">{fmt(d.cogs)}</td>}
                      {visible.has('grossProfit') && <td className={`px-4 py-3 ${d.grossProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fmt(d.grossProfit)}</td>}
                      {visible.has('grossMargin') && <td className={`px-4 py-3 text-sm ${d.grossMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>{d.grossMargin.toFixed(1)}%</td>}
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

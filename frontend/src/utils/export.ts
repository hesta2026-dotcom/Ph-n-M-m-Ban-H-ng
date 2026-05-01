import * as XLSX from 'xlsx'

export function exportExcel(filename: string, sheetName: string, headers: string[], rows: (string | number | null | undefined)[][]) {
  const data = [headers, ...rows.map(r => r.map(c => c ?? ''))]
  const ws = XLSX.utils.aoa_to_sheet(data)
  ws['!cols'] = headers.map((h, i) => ({ wch: Math.max(h.length + 2, ...rows.map(r => String(r[i] ?? '').length), 10) }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  XLSX.writeFile(wb, `${filename}.xlsx`)
}

export function exportPDF(filename: string, title: string, period: string, headers: string[], rows: (string | number | null | undefined)[][]) {
  const tableRows = rows.map(r => r.map(c => `<td>${c ?? ''}</td>`).join('')).map(r => `<tr>${r}</tr>`).join('')
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:Arial,sans-serif;font-size:11px;color:#111;padding:20px}
    h2{font-size:15px;font-weight:700;margin-bottom:4px}
    .period{color:#666;font-size:11px;margin-bottom:14px}
    .brand{color:#1d4ed8;font-size:12px;font-weight:600;margin-bottom:2px}
    table{width:100%;border-collapse:collapse;margin-top:8px}
    th{background:#f1f5f9;padding:7px 8px;text-align:left;border:1px solid #cbd5e1;font-weight:600;font-size:10px;white-space:nowrap}
    td{padding:6px 8px;border:1px solid #e2e8f0;font-size:10px}
    tr:nth-child(even) td{background:#f8fafc}
    .footer{margin-top:12px;font-size:9px;color:#94a3b8;text-align:right}
    @media print{body{padding:10px}button{display:none}}
  </style></head>
  <body>
    <div class="brand">Hesta Distribution</div>
    <h2>${title}</h2>
    <div class="period">${period}</div>
    <table><thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
    <tbody>${tableRows}</tbody></table>
    <div class="footer">Xuất ngày: ${new Date().toLocaleString('vi-VN')}</div>
    <script>window.onload=()=>{setTimeout(()=>{window.print()},300);window.onafterprint=()=>window.close()}</script>
  </body></html>`
  const win = window.open('', '_blank', 'width=900,height=700')
  if (win) { win.document.write(html); win.document.close() }
}

// Trả về chuỗi ngày YYYY-MM-DD theo giờ địa phương (không dùng UTC)
const localDateStr = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export const PRESETS = [
  { label: 'Hôm nay', getDates: (): [string, string] => { const d = localDateStr(new Date()); return [d, d] } },
  { label: '7 ngày', getDates: (): [string, string] => { const to = new Date(); const from = new Date(); from.setDate(from.getDate() - 6); return [localDateStr(from), localDateStr(to)] } },
  { label: 'Tháng này', getDates: (): [string, string] => { const n = new Date(); return [localDateStr(new Date(n.getFullYear(), n.getMonth(), 1)), localDateStr(n)] } },
  { label: 'Tháng trước', getDates: (): [string, string] => { const n = new Date(); return [localDateStr(new Date(n.getFullYear(), n.getMonth() - 1, 1)), localDateStr(new Date(n.getFullYear(), n.getMonth(), 0))] } },
  { label: 'Năm nay', getDates: (): [string, string] => { const n = new Date(); return [localDateStr(new Date(n.getFullYear(), 0, 1)), localDateStr(n)] } },
]

export function fmtPeriod(from: string, to: string) {
  return from === to ? `Ngày ${from}` : `Từ ${from} đến ${to}`
}

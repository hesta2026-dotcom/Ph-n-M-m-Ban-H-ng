import { useRef } from 'react'
import { X, Printer } from 'lucide-react'

const fmt = (n: number) => new Intl.NumberFormat('vi-VN').format(n) + 'đ'
const payLabel: any = { CASH: 'Tiền mặt', CARD: 'Thẻ ngân hàng', TRANSFER: 'Chuyển khoản', DEBT: 'Ghi nợ', MIXED: 'Hỗn hợp' }

interface Props { order: any; onClose: () => void }

export default function ExportSlip({ order, onClose }: Props) {
  const slipRef = useRef<HTMLDivElement>(null)

  const handlePrint = () => {
    const content = slipRef.current?.innerHTML
    if (!content) return
    const win = window.open('', '_blank', 'width=800,height=900')
    if (!win) return
    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8"/>
        <title>Phiếu xuất hàng - ${order.orderCode}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; font-size: 13px; color: #111; padding: 24px; }
          .header { text-align: center; border-bottom: 2px solid #111; padding-bottom: 12px; margin-bottom: 16px; }
          .header h1 { font-size: 22px; font-weight: bold; letter-spacing: 1px; }
          .header h2 { font-size: 14px; font-weight: normal; color: #555; margin-top: 4px; }
          .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 16px; }
          .info-row { display: flex; gap: 6px; font-size: 13px; }
          .info-row .label { color: #555; white-space: nowrap; }
          .info-row .value { font-weight: 600; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
          th { background: #f3f4f6; padding: 8px 10px; text-align: left; font-weight: 600; border: 1px solid #d1d5db; font-size: 12px; }
          th.right, td.right { text-align: right; }
          th.center, td.center { text-align: center; }
          td { padding: 7px 10px; border: 1px solid #e5e7eb; font-size: 12px; }
          tr:nth-child(even) td { background: #f9fafb; }
          .total-section { margin-left: auto; width: 280px; }
          .total-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 13px; }
          .total-row.grand { border-top: 2px solid #111; padding-top: 8px; margin-top: 4px; font-size: 15px; font-weight: bold; }
          .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-top: 40px; }
          .sig-box { text-align: center; }
          .sig-box .sig-title { font-weight: 600; margin-bottom: 4px; font-size: 12px; }
          .sig-box .sig-note { font-size: 11px; color: #777; }
          .sig-line { border-top: 1px dashed #999; margin-top: 48px; }
          .badge { display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 11px; font-weight: 600; }
          .badge-green { background: #dcfce7; color: #166534; }
          .badge-yellow { background: #fef9c3; color: #854d0e; }
          .badge-red { background: #fee2e2; color: #991b1b; }
          .badge-blue { background: #dbeafe; color: #1e40af; }
          @media print { body { padding: 12px; } }
        </style>
      </head>
      <body>${content}</body>
      </html>
    `)
    win.document.close()
    win.focus()
    setTimeout(() => { win.print(); }, 300)
  }

  const statusLabel: any = { PENDING: 'Chờ xử lý', COMPLETED: 'Hoàn thành', CANCELLED: 'Đã hủy', REFUNDED: 'Hoàn hàng' }
  const statusClass: any = { PENDING: 'badge-yellow', COMPLETED: 'badge-green', CANCELLED: 'badge-red', REFUNDED: 'badge-blue' }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0">
          <h2 className="font-bold text-gray-800">Phiếu xuất hàng — {order.orderCode}</h2>
          <div className="flex items-center gap-2">
            <button onClick={handlePrint} className="btn-primary flex items-center gap-2 py-2">
              <Printer size={16} /> In phiếu
            </button>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 ml-2"><X size={20} /></button>
          </div>
        </div>

        {/* Slip preview */}
        <div className="overflow-y-auto p-6">
          <div ref={slipRef} className="font-sans text-sm text-gray-900">
            {/* Header */}
            <div className="header text-center border-b-2 border-gray-900 pb-3 mb-4">
              <h1 className="text-2xl font-bold tracking-wide">PHIẾU XUẤT HÀNG</h1>
              <h2 className="text-sm text-gray-500 mt-1">POS System — Quản lý bán hàng</h2>
            </div>

            {/* Info grid */}
            <div className="info-grid grid grid-cols-2 gap-2 mb-4 text-sm">
              <div className="info-row flex gap-2"><span className="label text-gray-500">Mã đơn:</span><span className="value font-semibold font-mono">{order.orderCode}</span></div>
              <div className="info-row flex gap-2"><span className="label text-gray-500">Ngày:</span><span className="value font-semibold">{new Date(order.createdAt).toLocaleString('vi-VN')}</span></div>
              <div className="info-row flex gap-2"><span className="label text-gray-500">Khách hàng:</span><span className="value font-semibold">{order.customer?.name || 'Khách lẻ'}</span></div>
              <div className="info-row flex gap-2"><span className="label text-gray-500">SĐT:</span><span className="value font-semibold">{order.customer?.phone || '—'}</span></div>
              <div className="info-row flex gap-2"><span className="label text-gray-500">Nhân viên:</span><span className="value font-semibold">{order.user?.name}</span></div>
              <div className="info-row flex gap-2"><span className="label text-gray-500">Trạng thái:</span>
                <span className={`badge ${statusClass[order.status]}`}>{statusLabel[order.status]}</span>
              </div>
              {order.note && <div className="info-row flex gap-2 col-span-2"><span className="label text-gray-500">Ghi chú:</span><span className="value">{order.note}</span></div>}
            </div>

            {/* Product table */}
            <table className="w-full border-collapse mb-4 text-xs">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-300 px-2 py-2 text-left">STT</th>
                  <th className="border border-gray-300 px-2 py-2 text-left">Mã SP</th>
                  <th className="border border-gray-300 px-2 py-2 text-left">Tên sản phẩm</th>
                  <th className="border border-gray-300 px-2 py-2 text-center">ĐVT</th>
                  <th className="border border-gray-300 px-2 py-2 text-right">SL</th>
                  <th className="border border-gray-300 px-2 py-2 text-right">Đơn giá</th>
                  <th className="border border-gray-300 px-2 py-2 text-right">Thành tiền</th>
                </tr>
              </thead>
              <tbody>
                {order.items?.map((item: any, idx: number) => (
                  <tr key={item.id} className={idx % 2 === 1 ? 'bg-gray-50' : ''}>
                    <td className="border border-gray-200 px-2 py-1.5 text-center">{idx + 1}</td>
                    <td className="border border-gray-200 px-2 py-1.5 font-mono text-xs">{item.product?.code}</td>
                    <td className="border border-gray-200 px-2 py-1.5">{item.product?.name}</td>
                    <td className="border border-gray-200 px-2 py-1.5 text-center">{item.product?.unit || 'cái'}</td>
                    <td className="border border-gray-200 px-2 py-1.5 text-right font-medium">{item.qty}</td>
                    <td className="border border-gray-200 px-2 py-1.5 text-right">{fmt(item.price)}</td>
                    <td className="border border-gray-200 px-2 py-1.5 text-right font-semibold">{fmt(item.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals */}
            <div className="total-section ml-auto w-64 text-sm space-y-1">
              <div className="total-row flex justify-between">
                <span className="text-gray-500">Tạm tính:</span>
                <span>{fmt(order.subtotal)}</span>
              </div>
              {order.discount > 0 && (
                <div className="total-row flex justify-between text-red-600">
                  <span>Giảm giá:</span>
                  <span>- {fmt(order.discount)}</span>
                </div>
              )}
              <div className="total-row grand flex justify-between border-t-2 border-gray-900 pt-2 font-bold text-base">
                <span>TỔNG CỘNG:</span>
                <span className="text-blue-700">{fmt(order.total)}</span>
              </div>
              <div className="total-row flex justify-between text-gray-500 text-xs mt-1">
                <span>Thanh toán:</span>
                <span>{payLabel[order.paymentMethod]}</span>
              </div>
              {order.amountPaid > 0 && (
                <div className="total-row flex justify-between text-xs">
                  <span className="text-gray-500">Tiền nhận:</span>
                  <span>{fmt(order.amountPaid)}</span>
                </div>
              )}
              {order.change > 0 && (
                <div className="total-row flex justify-between text-xs text-green-600">
                  <span>Tiền thối:</span>
                  <span>{fmt(order.change)}</span>
                </div>
              )}
            </div>

            {/* Signatures */}
            <div className="signatures grid grid-cols-2 gap-8 mt-10">
              <div className="sig-box text-center">
                <p className="sig-title font-semibold text-sm">Người lập phiếu</p>
                <p className="sig-note text-xs text-gray-400">(Ký, ghi rõ họ tên)</p>
                <div className="sig-line border-t border-dashed border-gray-400 mt-12 pt-1">
                  <p className="text-xs text-gray-500">{order.user?.name}</p>
                </div>
              </div>
              <div className="sig-box text-center">
                <p className="sig-title font-semibold text-sm">Người nhận hàng</p>
                <p className="sig-note text-xs text-gray-400">(Ký, ghi rõ họ tên)</p>
                <div className="sig-line border-t border-dashed border-gray-400 mt-12 pt-1">
                  <p className="text-xs text-gray-500">{order.customer?.name || 'Khách lẻ'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

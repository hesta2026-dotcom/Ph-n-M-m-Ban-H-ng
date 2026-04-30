import { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../../services/api'
import toast from 'react-hot-toast'
import { X, UserPlus, AlertCircle, CheckCircle, UserCheck } from 'lucide-react'

const emptyForm = { name: '', phone: '', email: '', address: '' }

interface Props {
  onClose: () => void
  onCreated: (customer: any) => void
  /** Nếu có thì tự điền sẵn tên/SĐT từ ô tìm kiếm */
  defaultName?: string
}

export default function NewCustomerModal({ onClose, onCreated, defaultName = '' }: Props) {
  const qc = useQueryClient()
  const [form, setForm] = useState({ ...emptyForm, name: defaultName })
  const [phoneStatus, setPhoneStatus] = useState<'idle' | 'checking' | 'exists' | 'free'>('idle')
  const [existingCustomer, setExistingCustomer] = useState<any>(null)

  const set = (key: string, val: string) => setForm(f => ({ ...f, [key]: val }))

  // Kiểm tra SĐT trùng khi người dùng nhập (debounce 500ms)
  useEffect(() => {
    if (!form.phone || form.phone.length < 9) {
      setPhoneStatus('idle')
      setExistingCustomer(null)
      return
    }
    setPhoneStatus('checking')
    const timer = setTimeout(async () => {
      try {
        const res = await api.get(`/customers?search=${form.phone}&limit=1`)
        const found = res.data.data?.find((c: any) => c.phone === form.phone)
        if (found) {
          setPhoneStatus('exists')
          setExistingCustomer(found)
        } else {
          setPhoneStatus('free')
          setExistingCustomer(null)
        }
      } catch {
        setPhoneStatus('idle')
      }
    }, 500)
    return () => clearTimeout(timer)
  }, [form.phone])

  const save = useMutation({
    mutationFn: () => api.post('/customers', form),
    onSuccess: (res) => {
      toast.success('Đã tạo khách hàng mới')
      qc.invalidateQueries({ queryKey: ['customers'] })
      onCreated(res.data)
    },
    onError: (e: any) => {
      // 409: trùng SĐT — backend trả về existing
      if (e.response?.status === 409 && e.response.data?.existing) {
        setPhoneStatus('exists')
        setExistingCustomer(e.response.data.existing)
        toast.error('Số điện thoại đã tồn tại trong hệ thống')
      } else {
        toast.error(e.response?.data?.message || 'Lỗi tạo khách hàng')
      }
    }
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (phoneStatus === 'exists') {
      toast.error('Số điện thoại đã tồn tại — vui lòng chọn khách hàng từ danh sách')
      return
    }
    save.mutate()
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserPlus size={20} className="text-blue-600" />
            <h2 className="text-lg font-bold">Tạo khách hàng mới</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Tên */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tên khách hàng <span className="text-red-500">*</span>
            </label>
            <input className="input" required placeholder="Nhập họ tên khách hàng"
              value={form.name} onChange={e => set('name', e.target.value)} />
          </div>

          {/* SĐT — có kiểm tra trùng */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Số điện thoại</label>
            <div className="relative">
              <input
                className={`input pr-10 ${phoneStatus === 'exists' ? 'border-red-400 focus:ring-red-400' : phoneStatus === 'free' ? 'border-green-400 focus:ring-green-400' : ''}`}
                placeholder="0901 234 567"
                value={form.phone}
                onChange={e => set('phone', e.target.value)}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {phoneStatus === 'checking' && (
                  <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                )}
                {phoneStatus === 'exists' && <AlertCircle size={16} className="text-red-500" />}
                {phoneStatus === 'free' && <CheckCircle size={16} className="text-green-500" />}
              </div>
            </div>

            {/* Cảnh báo trùng + gợi ý chọn khách cũ */}
            {phoneStatus === 'exists' && existingCustomer && (
              <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                <div className="flex items-start gap-2">
                  <AlertCircle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-amber-800">Khách hàng đã tồn tại trong hệ thống</p>
                    <div className="mt-1.5 bg-white rounded-lg border border-amber-200 p-2.5 text-sm">
                      <p className="font-semibold text-gray-800">{existingCustomer.name}</p>
                      <p className="text-gray-500 text-xs mt-0.5">{existingCustomer.phone}{existingCustomer.email ? ` · ${existingCustomer.email}` : ''}</p>
                      {existingCustomer.address && <p className="text-gray-400 text-xs">{existingCustomer.address}</p>}
                    </div>
                    <button
                      type="button"
                      onClick={() => { onCreated(existingCustomer) }}
                      className="mt-2 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 transition-colors">
                      <UserCheck size={14} /> Chọn khách hàng này
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input className="input" type="email" placeholder="email@example.com"
              value={form.email} onChange={e => set('email', e.target.value)} />
          </div>

          {/* Địa chỉ */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Địa chỉ</label>
            <input className="input" placeholder="Số nhà, đường, quận, tỉnh/thành phố"
              value={form.address} onChange={e => set('address', e.target.value)} />
          </div>

          {/* Actions */}
          <div className="flex gap-3 justify-end pt-2 border-t">
            <button type="button" onClick={onClose} className="btn-outline">Hủy</button>
            <button
              type="submit"
              disabled={save.isPending || phoneStatus === 'exists'}
              className="btn-primary px-6 disabled:opacity-50">
              {save.isPending ? 'Đang tạo...' : 'Tạo khách hàng'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

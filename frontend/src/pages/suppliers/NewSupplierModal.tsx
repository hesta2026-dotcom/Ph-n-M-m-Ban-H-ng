import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../../services/api'
import toast from 'react-hot-toast'
import { X, Truck } from 'lucide-react'

const emptyForm = { name: '', phone: '', email: '', address: '', taxCode: '' }

interface Props {
  onClose: () => void
  onCreated: (supplier: any) => void
}

export default function NewSupplierModal({ onClose, onCreated }: Props) {
  const qc = useQueryClient()
  const [form, setForm] = useState(emptyForm)
  const set = (key: string, val: string) => setForm(f => ({ ...f, [key]: val }))

  const save = useMutation({
    mutationFn: () => api.post('/suppliers', form),
    onSuccess: (res) => {
      toast.success('Đã tạo nhà cung cấp mới')
      qc.invalidateQueries({ queryKey: ['suppliers'] })
      onCreated(res.data)
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Lỗi tạo nhà cung cấp')
  })

  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Truck size={20} className="text-blue-600" />
            <h2 className="text-lg font-bold">Tạo nhà cung cấp mới</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={e => { e.preventDefault(); save.mutate() }} className="p-6 space-y-4">
          {/* Tên NCC */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tên nhà cung cấp <span className="text-red-500">*</span>
            </label>
            <input className="input" required placeholder="Nhập tên công ty / cá nhân"
              value={form.name} onChange={e => set('name', e.target.value)} />
          </div>

          {/* SĐT + Email */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Số điện thoại</label>
              <input className="input" placeholder="0901 234 567"
                value={form.phone} onChange={e => set('phone', e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input className="input" type="email" placeholder="email@example.com"
                value={form.email} onChange={e => set('email', e.target.value)} />
            </div>
          </div>

          {/* Địa chỉ */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Địa chỉ</label>
            <input className="input" placeholder="Số nhà, đường, quận, tỉnh/thành phố"
              value={form.address} onChange={e => set('address', e.target.value)} />
          </div>

          {/* Mã số thuế */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mã số thuế</label>
            <input className="input" placeholder="VD: 0123456789"
              value={form.taxCode} onChange={e => set('taxCode', e.target.value)} />
          </div>

          {/* Actions */}
          <div className="flex gap-3 justify-end pt-2 border-t">
            <button type="button" onClick={onClose} className="btn-outline">Hủy</button>
            <button type="submit" disabled={save.isPending} className="btn-primary px-6">
              {save.isPending ? 'Đang tạo...' : 'Tạo nhà cung cấp'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

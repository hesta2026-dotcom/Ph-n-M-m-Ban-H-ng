import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../../services/api'
import toast from 'react-hot-toast'
import { X, FolderPlus } from 'lucide-react'

interface Props {
  onClose: () => void
  onCreated: (category: any) => void
}

export default function NewCategoryModal({ onClose, onCreated }: Props) {
  const qc = useQueryClient()
  const [name, setName] = useState('')

  const save = useMutation({
    mutationFn: () => api.post('/categories', { name }),
    onSuccess: (res) => {
      toast.success('Đã tạo danh mục mới')
      qc.invalidateQueries({ queryKey: ['categories'] })
      onCreated(res.data)
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Lỗi tạo danh mục')
  })

  return (
    <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-sm shadow-2xl">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FolderPlus size={18} className="text-blue-600" />
            <h2 className="font-bold">Tạo danh mục mới</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <form onSubmit={e => { e.preventDefault(); save.mutate() }} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tên danh mục <span className="text-red-500">*</span>
            </label>
            <input
              className="input"
              required
              autoFocus
              placeholder="VD: Đồ uống, Bánh kẹo, Thực phẩm..."
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </div>
          <div className="flex gap-3 justify-end pt-1 border-t">
            <button type="button" onClick={onClose} className="btn-outline">Hủy</button>
            <button type="submit" disabled={save.isPending || !name.trim()} className="btn-primary px-6 disabled:opacity-50">
              {save.isPending ? 'Đang tạo...' : 'Tạo danh mục'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

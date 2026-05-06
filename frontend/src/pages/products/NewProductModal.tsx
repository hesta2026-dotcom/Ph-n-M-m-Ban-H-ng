import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../../services/api'
import toast from 'react-hot-toast'
import { X, ImagePlus, FolderPlus } from 'lucide-react'
import NewCategoryModal from './NewCategoryModal'

const SMALL_UNITS = ['cái','chai','dây','bịch','gói','lon','lọ','túi','chiếc','hộp','cặp','bộ','kg','g','lít','ml']
const BIG_UNITS   = ['thùng','hộp','kiện','bộ','bao','lốc','vỉ','bịch']
const fmtMoney = (n: number) => n === 0 ? '' : n.toLocaleString('vi-VN')
const parseMoney = (s: string) => +s.replace(/[^0-9]/g, '') || 0
const MARGIN = 1.065
const suggestPrice = (cost: number) => cost > 0 ? Math.round(cost * MARGIN / 500) * 500 : 0

const removeDiacritics = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '')
   .replace(/đ/g, 'd').replace(/Đ/g, 'D')

function generateCode(name: string): string {
  const clean = removeDiacritics(name.trim())
  const words = clean.split(/\s+/).filter(Boolean)
  const measurements: string[] = []
  const textWords: string[] = []
  for (const w of words) {
    if (/^\d+([.,]\d+)?(kg|g|ml|l|m|x)?$/i.test(w) || /^\d+$/.test(w)) {
      measurements.push(w.toUpperCase().replace(',', '.'))
    } else {
      textWords.push(w)
    }
  }
  const initials = textWords.map(w => w[0].toUpperCase()).join('')
  return initials + measurements.join('')
}

const emptyForm = {
  name: '', code: '', barcode: '', price: 0, costPrice: 0,
  stock: 0, minStock: 5, unit: 'cái',
  packageUnit: '', packageQty: '' as string | number,
  categoryId: '', supplierId: '', description: '',
  brand: '', manufacturer: '', specification: '',
  image: '', images: [] as string[]
}

interface Props {
  onClose: () => void
  onCreated: (product: any) => void
  defaultSupplierId?: string
}

export default function NewProductModal({ onClose, onCreated, defaultSupplierId = '' }: Props) {
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [form, setForm] = useState({ ...emptyForm, supplierId: defaultSupplierId })
  const [uploading, setUploading] = useState(false)
  const [showNewCategory, setShowNewCategory] = useState(false)
  const [priceAutoSet, setPriceAutoSet] = useState(false)
  const [codeAutoSet, setCodeAutoSet] = useState(true)

  const set = (key: string, val: any) => setForm(f => ({ ...f, [key]: val }))

  const handleCostPriceChange = (val: number) => {
    set('costPrice', val)
    if (priceAutoSet || form.price === 0) {
      set('price', suggestPrice(val))
      setPriceAutoSet(true)
    }
  }

  const handlePriceChange = (val: number) => {
    set('price', val)
    setPriceAutoSet(val === suggestPrice(form.costPrice))
  }

  const { data: categories } = useQuery({ queryKey: ['categories'], queryFn: () => api.get('/categories').then(r => r.data) })
  const { data: suppliers } = useQuery({ queryKey: ['suppliers'], queryFn: () => api.get('/suppliers').then(r => r.data) })

  const save = useMutation({
    mutationFn: (d: any) => api.post('/products', d),
    onSuccess: (res) => {
      toast.success('Đã tạo sản phẩm mới')
      qc.invalidateQueries({ queryKey: ['products-all'] })
      qc.invalidateQueries({ queryKey: ['products'] })
      onCreated(res.data)
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Lỗi tạo sản phẩm')
  })

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setUploading(true)
    try {
      const fd = new FormData()
      Array.from(files).forEach(f => fd.append('images', f))
      const res = await api.post('/products/upload-images', fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      const newUrls: string[] = res.data.urls
      setForm(f => {
        const all = [...f.images, ...newUrls]
        return { ...f, images: all, image: all[0] || f.image }
      })
    } catch {
      toast.error('Lỗi upload ảnh')
    } finally {
      setUploading(false)
    }
  }

  const removeImage = (url: string) => {
    setForm(f => {
      const imgs = f.images.filter(u => u !== url)
      return { ...f, images: imgs, image: imgs[0] || '' }
    })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    save.mutate({
      ...form,
      packageQty: form.packageQty !== '' ? +form.packageQty : null,
      images: form.images.length ? JSON.stringify(form.images) : null
    })
  }

  return (
    <>
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 border-b flex items-center justify-between flex-shrink-0">
          <h2 className="text-lg font-bold">Tạo sản phẩm mới</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-6">

          {/* ── Thông tin cơ bản ── */}
          <section>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Thông tin cơ bản</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Tên sản phẩm *</label>
                <input className="input" required value={form.name}
                  onChange={e => {
                    const name = e.target.value
                    set('name', name)
                    if (codeAutoSet) set('code', generateCode(name))
                  }}
                  placeholder="Nhập tên sản phẩm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Mã sản phẩm *
                  {codeAutoSet && form.code && <span className="ml-2 text-xs text-blue-500 font-normal">tự động</span>}
                </label>
                <input className="input" required value={form.code}
                  onChange={e => { set('code', e.target.value.toUpperCase()); setCodeAutoSet(false) }}
                  onFocus={() => { if (codeAutoSet && !form.code) setCodeAutoSet(true) }}
                  placeholder="VD: SP001" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Barcode</label>
                <input className="input" value={form.barcode} onChange={e => set('barcode', e.target.value)} placeholder="Mã vạch" />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Đơn vị tính</label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Đơn vị bán lẻ</p>
                    <select className="input" value={form.unit} onChange={e => set('unit', e.target.value)}>
                      {SMALL_UNITS.map(u => <option key={u} value={u}>{u.charAt(0).toUpperCase() + u.slice(1)}</option>)}
                    </select>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Quy cách đóng gói</p>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500 whitespace-nowrap">1</span>
                      <input className="input w-24" list="nm-big-units" value={form.packageUnit}
                        onChange={e => set('packageUnit', e.target.value)} placeholder="thùng..." />
                      <datalist id="nm-big-units">
                        {BIG_UNITS.map(u => <option key={u} value={u} />)}
                      </datalist>
                      <span className="text-sm text-gray-500">=</span>
                      <input className="input w-20" type="number" min={1} value={form.packageQty}
                        onChange={e => set('packageQty', e.target.value)} placeholder="60" />
                      <span className="text-sm text-gray-500 truncate max-w-[48px]">{form.unit || 'đơn vị'}</span>
                    </div>
                    {form.packageUnit && form.packageQty && (
                      <p className="text-xs text-blue-600 mt-1">1 {form.packageUnit} = {form.packageQty} {form.unit}</p>
                    )}
                  </div>
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-700">Danh mục</label>
                  <button type="button" onClick={() => setShowNewCategory(true)}
                    className="flex items-center gap-1 text-xs text-green-600 hover:text-green-700 font-medium">
                    <FolderPlus size={13} /> Tạo mới
                  </button>
                </div>
                <select className="input" value={form.categoryId} onChange={e => set('categoryId', e.target.value)}>
                  <option value="">-- Chọn danh mục --</option>
                  {categories?.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nhà cung cấp</label>
                <select className="input" value={form.supplierId} onChange={e => set('supplierId', e.target.value)}>
                  <option value="">-- Chọn NCC --</option>
                  {suppliers?.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </div>
          </section>

          {/* ── Thương hiệu & Sản xuất ── */}
          <section>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Thương hiệu & Sản xuất</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tên thương hiệu</label>
                <input className="input" value={form.brand} onChange={e => set('brand', e.target.value)} placeholder="VD: Samsung, Vinamilk..." />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Công ty sản xuất</label>
                <input className="input" value={form.manufacturer} onChange={e => set('manufacturer', e.target.value)} placeholder="Tên công ty" />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Quy cách đóng gói</label>
                <input className="input" value={form.specification} onChange={e => set('specification', e.target.value)} placeholder="VD: 1 thùng / 24 lon, 500ml/chai..." />
              </div>
            </div>
          </section>

          {/* ── Giá & Kho ── */}
          <section>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Giá & Kho hàng</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm font-medium text-gray-700">Giá bán *</label>
                  {priceAutoSet && form.price > 0 && (
                    <span className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-medium">
                      Gợi ý ×{MARGIN}
                    </span>
                  )}
                </div>
                <div className="relative">
                  <input className={`input pr-8 text-right ${priceAutoSet ? 'border-blue-300 bg-blue-50/30' : ''}`}
                    required placeholder="0"
                    value={fmtMoney(form.price)}
                    onChange={e => handlePriceChange(parseMoney(e.target.value))} />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">đ</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Giá vốn</label>
                <div className="relative">
                  <input className="input pr-8 text-right" placeholder="0"
                    value={fmtMoney(form.costPrice)}
                    onChange={e => handleCostPriceChange(parseMoney(e.target.value))} />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">đ</span>
                </div>
                {form.costPrice > 0 && (
                  <p className="text-xs text-gray-400 mt-1">
                    Gợi ý giá bán: <button type="button" className="text-blue-500 font-medium hover:underline"
                      onClick={() => { set('price', suggestPrice(form.costPrice)); setPriceAutoSet(true) }}>
                      {fmtMoney(suggestPrice(form.costPrice))}đ
                    </button>
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tồn kho ban đầu</label>
                <input className="input" type="number" min={0} value={form.stock} onChange={e => set('stock', +e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tồn kho tối thiểu</label>
                <input className="input" type="number" min={0} value={form.minStock} onChange={e => set('minStock', +e.target.value)} />
              </div>
            </div>
          </section>

          {/* ── Hình ảnh ── */}
          <section>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Hình ảnh sản phẩm</h3>
            <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
              onChange={e => handleUpload(e.target.files)} />
            <div className="flex flex-wrap gap-3">
              {form.images.map((url, i) => (
                <div key={url} className="relative group">
                  <img src={url} alt="" className="w-20 h-20 object-cover rounded-xl border-2 border-gray-200" />
                  {i === 0 && <span className="absolute top-1 left-1 bg-blue-600 text-white text-xs px-1 py-0.5 rounded">Chính</span>}
                  <button type="button" onClick={() => removeImage(url)}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <X size={11} />
                  </button>
                </div>
              ))}
              <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
                className="w-20 h-20 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center gap-1 hover:border-blue-400 hover:bg-blue-50 transition-colors text-gray-400 hover:text-blue-500 disabled:opacity-50">
                {uploading
                  ? <div className="animate-spin w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full" />
                  : <><ImagePlus size={20} /><span className="text-xs">Thêm ảnh</span></>}
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-2">Tối đa 5 ảnh · dưới 5MB mỗi ảnh</p>
          </section>

          {/* ── Mô tả ── */}
          <section>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mô tả sản phẩm</label>
            <textarea className="input resize-none" rows={2} value={form.description}
              onChange={e => set('description', e.target.value)} placeholder="Mô tả chi tiết..." />
          </section>

          {/* Actions */}
          <div className="flex gap-3 justify-end pt-2 border-t">
            <button type="button" onClick={onClose} className="btn-outline">Hủy</button>
            <button type="submit" disabled={save.isPending} className="btn-primary px-8">
              {save.isPending ? 'Đang tạo...' : 'Tạo sản phẩm'}
            </button>
          </div>
        </form>
      </div>
    </div>

    {showNewCategory && (
      <NewCategoryModal
        onClose={() => setShowNewCategory(false)}
        onCreated={(cat) => { set('categoryId', cat.id); setShowNewCategory(false) }}
      />
    )}
    </>
  )
}

import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../../services/api'
import toast from 'react-hot-toast'
import { Plus, Search, Edit2, Trash2, ImagePlus, X, Package, Tag, Building2, Upload, Download, FileSpreadsheet, FolderPlus } from 'lucide-react'
import NewCategoryModal from './NewCategoryModal'

const fmt = (n: number) => new Intl.NumberFormat('vi-VN').format(n) + 'đ'

const emptyForm = {
  name: '', code: '', barcode: '', price: 0, costPrice: 0,
  stock: 0, minStock: 5, unit: 'cái',
  packageUnit: '', packageQty: '' as string | number,
  categoryId: '', supplierId: '', description: '',
  brand: '', manufacturer: '', specification: '',
  image: '', images: [] as string[]
}

const SMALL_UNITS = ['cái','chai','dây','bịch','gói','lon','lọ','túi','chiếc','hộp','cặp','bộ','kg','g','lít','ml']
const BIG_UNITS   = ['thùng','hộp','kiện','bộ','bao','lốc','vỉ','bịch']
const fmtMoney = (n: number) => n === 0 ? '' : n.toLocaleString('vi-VN')
const parseMoney = (s: string) => +s.replace(/[^0-9]/g, '') || 0

export default function Products() {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form, setForm] = useState(emptyForm)
  const [uploading, setUploading] = useState(false)
  const [previewProduct, setPreviewProduct] = useState<any>(null)
  const [importResult, setImportResult] = useState<any>(null)
  const [importing, setImporting] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [inlineUploadId, setInlineUploadId] = useState<string | null>(null)
  const [showNewCategory, setShowNewCategory] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const importRef = useRef<HTMLInputElement>(null)
  const inlineRef = useRef<HTMLInputElement>(null)
  const qc = useQueryClient()

  const handleInlineUpload = async (file: File | null) => {
    if (!file || !inlineUploadId) return
    try {
      const fd = new FormData()
      fd.append('images', file)
      const res = await api.post('/products/upload-images', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      const imageUrl = res.data.urls[0]
      await api.patch(`/products/${inlineUploadId}/image`, { image: imageUrl })
      toast.success('Đã cập nhật ảnh sản phẩm')
      qc.invalidateQueries({ queryKey: ['products'] })
    } catch { toast.error('Lỗi upload ảnh') }
    finally {
      setInlineUploadId(null)
      if (inlineRef.current) inlineRef.current.value = ''
    }
  }

  const handleExport = async () => {
    try {
      const params = selectedIds.size > 0 ? `?ids=${[...selectedIds].join(',')}` : ''
      const res = await api.get(`/products/export${params}`, { responseType: 'blob' })
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      const today = new Date().toISOString().slice(0, 10)
      a.download = `san_pham_${today}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } catch { toast.error('Lỗi xuất file') }
  }

  const handleDownloadTemplate = async () => {
    try {
      const res = await api.get('/products/template', { responseType: 'blob' })
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      a.download = 'mau_san_pham.xlsx'
      a.click()
      URL.revokeObjectURL(url)
    } catch { toast.error('Lỗi tải file mẫu') }
  }

  const handleImport = async (file: File | null) => {
    if (!file) return
    setImporting(true)
    setImportResult(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await api.post('/products/import', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      setImportResult(res.data)
      if (res.data.created > 0) {
        toast.success(`Đã import ${res.data.created} sản phẩm`)
        qc.invalidateQueries({ queryKey: ['products'] })
      } else {
        toast.error('Không có sản phẩm nào được thêm')
      }
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Lỗi import file')
    } finally {
      setImporting(false)
      if (importRef.current) importRef.current.value = ''
    }
  }

  const { data, isLoading } = useQuery({
    queryKey: ['products', search, page],
    queryFn: () => api.get(`/products?search=${search}&page=${page}&limit=20`).then(r => r.data)
  })
  const { data: categories } = useQuery({ queryKey: ['categories'], queryFn: () => api.get('/categories').then(r => r.data) })
  const { data: suppliers } = useQuery({ queryKey: ['suppliers'], queryFn: () => api.get('/suppliers').then(r => r.data) })

  const set = (key: string, val: any) => setForm(f => ({ ...f, [key]: val }))

  const save = useMutation({
    mutationFn: (d: any) => editing ? api.put(`/products/${editing.id}`, d) : api.post('/products', d),
    onSuccess: () => {
      toast.success(editing ? 'Đã cập nhật sản phẩm' : 'Đã thêm sản phẩm')
      qc.invalidateQueries({ queryKey: ['products'] })
      setShowForm(false); setEditing(null); setForm(emptyForm)
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Lỗi lưu sản phẩm')
  })

  const del = useMutation({
    mutationFn: (id: string) => api.delete(`/products/${id}`),
    onSuccess: () => { toast.success('Đã xóa sản phẩm'); qc.invalidateQueries({ queryKey: ['products'] }) }
  })

  const openEdit = (p: any) => {
    setEditing(p)
    setForm({
      name: p.name, code: p.code, barcode: p.barcode || '',
      price: p.price, costPrice: p.costPrice, stock: p.stock,
      minStock: p.minStock, unit: p.unit,
      packageUnit: p.packageUnit || '', packageQty: p.packageQty || '',
      categoryId: p.categoryId || '', supplierId: p.supplierId || '',
      description: p.description || '',
      brand: p.brand || '', manufacturer: p.manufacturer || '',
      specification: p.specification || '',
      image: p.image || '',
      images: p.images ? JSON.parse(p.images) : []
    })
    setShowForm(true)
  }

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
      toast.success(`Đã upload ${newUrls.length} ảnh`)
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Lỗi upload ảnh')
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
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">Sản phẩm</h1>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Hidden file inputs */}
          <input ref={importRef} type="file" accept=".xlsx,.xls" className="hidden"
            onChange={e => handleImport(e.target.files?.[0] || null)} />
          <input ref={inlineRef} type="file" accept="image/*" className="hidden"
            onChange={e => handleInlineUpload(e.target.files?.[0] || null)} />

          <button onClick={handleDownloadTemplate}
            className="btn-outline flex items-center gap-1.5 text-sm">
            <FileSpreadsheet size={15} /> File mẫu
          </button>
          <button onClick={() => importRef.current?.click()} disabled={importing}
            className="btn-outline flex items-center gap-1.5 text-sm disabled:opacity-50">
            <Upload size={15} /> {importing ? 'Đang import...' : 'Import Excel'}
          </button>
          <button onClick={handleExport}
            className={`flex items-center gap-1.5 text-sm ${selectedIds.size > 0 ? 'btn-primary' : 'btn-outline'}`}>
            <Download size={15} />
            {selectedIds.size > 0 ? `Xuất ${selectedIds.size} sản phẩm` : 'Xuất Excel'}
          </button>
          {selectedIds.size > 0 && (
            <button onClick={() => setSelectedIds(new Set())}
              className="text-xs text-gray-400 hover:text-gray-600 underline">
              Bỏ chọn
            </button>
          )}
          <button onClick={() => { setEditing(null); setForm(emptyForm); setShowForm(true) }}
            className="btn-primary flex items-center gap-2">
            <Plus size={18} /> Thêm sản phẩm
          </button>
        </div>
      </div>

      {/* Kết quả import */}
      {importResult && (
        <div className={`p-4 rounded-xl border text-sm ${importResult.created > 0 ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
          <div className="flex items-center justify-between">
            <div>
              <span className="font-semibold text-green-700">Đã thêm: {importResult.created} sản phẩm</span>
              {importResult.skipped > 0 && <span className="ml-3 text-gray-500">Bỏ qua: {importResult.skipped}</span>}
            </div>
            <button onClick={() => setImportResult(null)} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
          </div>
          {importResult.errors?.length > 0 && (
            <ul className="mt-2 space-y-0.5 text-xs text-red-600">
              {importResult.errors.map((err: string, i: number) => <li key={i}>• {err}</li>)}
            </ul>
          )}
        </div>
      )}

      <div className="relative">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input className="input pl-10" placeholder="Tìm theo tên, mã, barcode, thương hiệu..."
          value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} />
      </div>

      {/* Danh sách sản phẩm */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-3 py-3 w-10">
                  <input type="checkbox"
                    className="w-4 h-4 rounded cursor-pointer accent-blue-600"
                    checked={data?.data?.length > 0 && data.data.every((p: any) => selectedIds.has(p.id))}
                    onChange={e => {
                      const ids = data?.data?.map((p: any) => p.id) ?? []
                      if (e.target.checked) setSelectedIds(prev => new Set([...prev, ...ids]))
                      else setSelectedIds(prev => { const s = new Set(prev); ids.forEach((id: string) => s.delete(id)); return s })
                    }}
                  />
                </th>
                {['Ảnh', 'Mã SP', 'Tên sản phẩm', 'Thương hiệu / SX', 'Danh mục', 'Giá bán', 'Giá vốn', 'Tồn kho', 'Thao tác'].map(h => (
                  <th key={h} className="px-3 py-3 text-left font-medium text-gray-600 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading && <tr><td colSpan={10} className="text-center py-10 text-gray-400">Đang tải...</td></tr>}
              {!isLoading && !data?.data?.length && <tr><td colSpan={10} className="text-center py-10 text-gray-400">Không có sản phẩm nào</td></tr>}
              {data?.data?.map((p: any) => {
                const imgs: string[] = p.images ? JSON.parse(p.images) : []
                const thumb = p.image || imgs[0]
                const checked = selectedIds.has(p.id)
                return (
                  <tr key={p.id} className={`hover:bg-gray-50 ${checked ? 'bg-blue-50' : ''}`}>
                    <td className="px-3 py-2">
                      <input type="checkbox"
                        className="w-4 h-4 rounded cursor-pointer accent-blue-600"
                        checked={checked}
                        onChange={e => {
                          setSelectedIds(prev => {
                            const s = new Set(prev)
                            e.target.checked ? s.add(p.id) : s.delete(p.id)
                            return s
                          })
                        }}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <button
                        title="Click để tải ảnh lên"
                        onClick={() => { setInlineUploadId(p.id); inlineRef.current?.click() }}
                        className="relative w-12 h-12 rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center flex-shrink-0 group hover:ring-2 hover:ring-blue-400 transition-all">
                        {inlineUploadId === p.id
                          ? <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                          : thumb
                            ? <img src={thumb} alt="" className="w-full h-full object-cover" />
                            : <Package size={18} className="text-gray-400" />}
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <ImagePlus size={16} className="text-white" />
                        </div>
                      </button>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-gray-500">{p.code}</td>
                    <td className="px-3 py-2">
                      <p className="font-medium">{p.name}</p>
                      {p.specification && <p className="text-xs text-gray-400">{p.specification}</p>}
                    </td>
                    <td className="px-3 py-2">
                      {p.brand && <p className="font-medium flex items-center gap-1"><Tag size={11} className="text-purple-400" />{p.brand}</p>}
                      {p.manufacturer && <p className="text-xs text-gray-400 flex items-center gap-1"><Building2 size={11} />{p.manufacturer}</p>}
                    </td>
                    <td className="px-3 py-2 text-gray-500">{p.category?.name || '-'}</td>
                    <td className="px-3 py-2 text-blue-600 font-semibold whitespace-nowrap">{fmt(p.price)}</td>
                    <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{fmt(p.costPrice)}</td>
                    <td className="px-3 py-2">
                      <span className={`badge ${p.stock <= p.minStock ? 'badge-red' : 'badge-green'}`}>{p.stock} {p.unit}</span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex gap-2">
                        <button onClick={() => openEdit(p)} className="text-blue-500 hover:text-blue-700"><Edit2 size={15} /></button>
                        <button onClick={() => { if (confirm('Xóa sản phẩm này?')) del.mutate(p.id) }} className="text-red-400 hover:text-red-600"><Trash2 size={15} /></button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t flex items-center justify-between text-sm text-gray-500">
          <span>Tổng: <strong>{data?.total || 0}</strong> sản phẩm</span>
          <div className="flex gap-2">
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="btn-outline px-3 py-1 text-xs disabled:opacity-40">Trước</button>
            <span className="px-2">Trang {page}</span>
            <button disabled={!data?.data?.length || data.data.length < 20} onClick={() => setPage(p => p + 1)} className="btn-outline px-3 py-1 text-xs disabled:opacity-40">Sau</button>
          </div>
        </div>
      </div>

      {/* ==================== Modal xem ảnh ==================== */}
      {previewProduct && (() => {
        const imgs: string[] = previewProduct.images ? JSON.parse(previewProduct.images) : previewProduct.image ? [previewProduct.image] : []
        return (
          <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setPreviewProduct(null)}>
            <div className="bg-white rounded-xl max-w-lg w-full p-5" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-lg">{previewProduct.name}</h3>
                <button onClick={() => setPreviewProduct(null)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
              </div>
              {imgs.length > 0 ? (
                <div className="grid grid-cols-3 gap-2">
                  {imgs.map((url, i) => (
                    <img key={i} src={url} alt={`Ảnh ${i + 1}`} className="w-full aspect-square object-cover rounded-lg" />
                  ))}
                </div>
              ) : (
                <div className="h-40 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400">
                  <Package size={40} />
                </div>
              )}
              <div className="mt-4 space-y-1 text-sm text-gray-600">
                {previewProduct.brand && <p><span className="text-gray-400">Thương hiệu:</span> <strong>{previewProduct.brand}</strong></p>}
                {previewProduct.manufacturer && <p><span className="text-gray-400">Công ty SX:</span> {previewProduct.manufacturer}</p>}
                {previewProduct.specification && <p><span className="text-gray-400">Quy cách:</span> {previewProduct.specification}</p>}
                {previewProduct.description && <p><span className="text-gray-400">Mô tả:</span> {previewProduct.description}</p>}
              </div>
            </div>
          </div>
        )
      })()}

      {showNewCategory && (
        <NewCategoryModal
          onClose={() => setShowNewCategory(false)}
          onCreated={(cat) => { set('categoryId', cat.id); setShowNewCategory(false) }}
        />
      )}

      {/* ==================== Modal form thêm/sửa ==================== */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-3xl max-h-[92vh] flex flex-col">
            <div className="px-6 py-4 border-b flex items-center justify-between flex-shrink-0">
              <h2 className="text-lg font-bold">{editing ? 'Sửa sản phẩm' : 'Thêm sản phẩm mới'}</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>

            <form onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-6">
              {/* ── Thông tin cơ bản ── */}
              <section>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Thông tin cơ bản</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tên sản phẩm *</label>
                    <input className="input" required value={form.name} onChange={e => set('name', e.target.value)} placeholder="Nhập tên sản phẩm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Mã sản phẩm *</label>
                    <input className="input" required value={form.code} onChange={e => set('code', e.target.value)} placeholder="VD: SP001" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Barcode</label>
                    <input className="input" value={form.barcode} onChange={e => set('barcode', e.target.value)} placeholder="Mã vạch" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Đơn vị tính</label>
                    <div className="grid grid-cols-2 gap-3">
                      {/* Đơn vị nhỏ (bán lẻ) */}
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Đơn vị bán lẻ</p>
                        <select className="input" value={form.unit} onChange={e => set('unit', e.target.value)}>
                          {SMALL_UNITS.map(u => <option key={u} value={u}>{u.charAt(0).toUpperCase() + u.slice(1)}</option>)}
                        </select>
                      </div>
                      {/* Quy cách đóng gói */}
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Quy cách đóng gói</p>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-500 whitespace-nowrap">1</span>
                          <input className="input w-28" list="big-units" value={form.packageUnit}
                            onChange={e => set('packageUnit', e.target.value)} placeholder="thùng, hộp..." />
                          <datalist id="big-units">
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
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Thương hiệu & Sản xuất</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tên thương hiệu</label>
                    <input className="input" value={form.brand} onChange={e => set('brand', e.target.value)} placeholder="VD: Samsung, Vinamilk..." />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Công ty sản xuất</label>
                    <input className="input" value={form.manufacturer} onChange={e => set('manufacturer', e.target.value)} placeholder="Tên công ty sản xuất" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Quy cách đóng gói</label>
                    <input className="input" value={form.specification} onChange={e => set('specification', e.target.value)} placeholder="VD: 1 thùng / 24 lon, 500ml/chai, 1kg/túi..." />
                  </div>
                </div>
              </section>

              {/* ── Giá & Kho ── */}
              <section>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Giá & Kho hàng</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Giá bán *</label>
                    <div className="relative">
                      <input className="input pr-8 text-right" required placeholder="0"
                        value={fmtMoney(form.price)}
                        onChange={e => set('price', parseMoney(e.target.value))} />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">đ</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Giá vốn</label>
                    <div className="relative">
                      <input className="input pr-8 text-right" placeholder="0"
                        value={fmtMoney(form.costPrice)}
                        onChange={e => set('costPrice', parseMoney(e.target.value))} />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">đ</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tồn kho</label>
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
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Hình ảnh sản phẩm</h3>
                <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
                  onChange={e => handleUpload(e.target.files)} />

                <div className="flex flex-wrap gap-3 mb-3">
                  {form.images.map((url, i) => (
                    <div key={url} className="relative group">
                      <img src={url} alt="" className="w-24 h-24 object-cover rounded-xl border-2 border-gray-200" />
                      {i === 0 && <span className="absolute top-1 left-1 bg-blue-600 text-white text-xs px-1.5 py-0.5 rounded-md">Chính</span>}
                      <button type="button" onClick={() => removeImage(url)}
                        className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <X size={11} />
                      </button>
                    </div>
                  ))}

                  <button type="button" onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="w-24 h-24 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center gap-1 hover:border-blue-400 hover:bg-blue-50 transition-colors text-gray-400 hover:text-blue-500 disabled:opacity-50">
                    {uploading ? (
                      <div className="animate-spin w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full" />
                    ) : (
                      <>
                        <ImagePlus size={22} />
                        <span className="text-xs">Thêm ảnh</span>
                      </>
                    )}
                  </button>
                </div>
                <p className="text-xs text-gray-400">Tối đa 5 ảnh, mỗi ảnh dưới 5MB. Ảnh đầu tiên là ảnh chính.</p>
              </section>

              {/* ── Mô tả ── */}
              <section>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mô tả sản phẩm</label>
                <textarea className="input resize-none" rows={3} value={form.description}
                  onChange={e => set('description', e.target.value)} placeholder="Mô tả chi tiết..." />
              </section>

              <div className="flex gap-3 justify-end pt-2 border-t">
                <button type="button" onClick={() => setShowForm(false)} className="btn-outline">Hủy</button>
                <button type="submit" disabled={save.isPending} className="btn-primary px-8">
                  {save.isPending ? 'Đang lưu...' : 'Lưu sản phẩm'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

import { useState, useRef, useEffect } from 'react'
import { Columns3 } from 'lucide-react'

export type ColDef = { key: string; label: string }

interface Props {
  cols: ColDef[]
  visible: Set<string>
  onChange: (keys: Set<string>) => void
}

export default function ColumnPicker({ cols, visible, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const allSelected = cols.every(c => visible.has(c.key))

  const toggle = (key: string) => {
    const next = new Set(visible)
    if (next.has(key) && next.size > 1) next.delete(key)
    else if (!next.has(key)) next.add(key)
    onChange(next)
  }

  const toggleAll = () => {
    onChange(allSelected ? new Set([cols[0].key]) : new Set(cols.map(c => c.key)))
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border bg-white hover:bg-gray-50 text-sm font-medium text-gray-700 whitespace-nowrap"
      >
        <Columns3 size={14} />
        Cột <span className="text-gray-400 text-xs ml-0.5">({visible.size}/{cols.length})</span>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 bg-white border rounded-xl shadow-lg z-50 min-w-[190px] py-2">
          <button
            onClick={toggleAll}
            className="w-full text-left px-4 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-50 transition-colors"
          >
            {allSelected ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
          </button>
          <div className="border-t my-1.5" />
          {cols.map(c => (
            <label
              key={c.key}
              className="flex items-center gap-2.5 px-4 py-1.5 hover:bg-gray-50 cursor-pointer text-sm select-none"
            >
              <input
                type="checkbox"
                checked={visible.has(c.key)}
                onChange={() => toggle(c.key)}
                className="rounded accent-blue-600"
              />
              <span className={visible.has(c.key) ? 'text-gray-800' : 'text-gray-400'}>{c.label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

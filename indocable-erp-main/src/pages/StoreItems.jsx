import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../supabase'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'
import {
  Package, Plus, Edit2, Search, X, RefreshCw, Image, ToggleLeft, ToggleRight, Tag
} from 'lucide-react'
import AccessDenied from '../components/AccessDenied'

const CATEGORIES = ['Electrical', 'Mechanical', 'Tools', 'Consumables', 'Hardware', 'Safety', 'Other']
const UNITS = ['pcs', 'kg', 'm', 'box', 'roll', 'set', 'ltr']

const CATEGORY_BADGE = {
  Electrical:   'bg-yellow-100 text-yellow-700',
  Mechanical:   'bg-blue-100 text-blue-700',
  Tools:        'bg-orange-100 text-orange-700',
  Consumables:  'bg-green-100 text-green-700',
  Hardware:     'bg-slate-100 text-slate-700',
  Safety:       'bg-red-100 text-red-700',
  Other:        'bg-gray-100 text-gray-600',
}

const WRITE_ROLES = ['owner', 'admin', 'procurement', 'security_guard']

const EMPTY_FORM = {
  name: '',
  description: '',
  category: 'Electrical',
  unit: 'pcs',
  is_active: true,
  item_image_url: '',
  min_qty: '',
  max_qty: '',
}

export default function StoreItems({ profile }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('all')
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState('')
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef(null)

  const canWrite = WRITE_ROLES.includes(profile?.role)
  const { t } = useTranslation()

  const fetchItems = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('store_items')
      .select('*')
      .order('category')
      .order('name')
    if (error) {
      toast.error('Failed to load items: ' + error.message)
    } else {
      setItems(data || [])
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchItems() }, [fetchItems])

  const filtered = items.filter(item => {
    const matchSearch =
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      (item.category || '').toLowerCase().includes(search.toLowerCase()) ||
      (item.description || '').toLowerCase().includes(search.toLowerCase())
    const matchCat = catFilter === 'all' || item.category === catFilter
    return matchSearch && matchCat
  })

  function openAdd() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setImageFile(null)
    setImagePreview('')
    setShowModal(true)
  }

  function openEdit(item) {
    setEditingId(item.id)
    setForm({
      name: item.name || '',
      description: item.description || '',
      category: item.category || 'Electrical',
      unit: item.unit || 'pcs',
      is_active: item.is_active ?? true,
      item_image_url: item.item_image_url || '',
      min_qty: item.min_qty != null ? String(item.min_qty) : '',
      max_qty: item.max_qty != null ? String(item.max_qty) : '',
    })
    setImageFile(null)
    setImagePreview(item.item_image_url || '')
    setShowModal(true)
  }

  function closeModal() {
    setShowModal(false)
    setEditingId(null)
    setForm(EMPTY_FORM)
    setImageFile(null)
    setImagePreview('')
  }

  function handleImageSelect(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { toast.error('Please select an image file'); return }
    if (file.size > 5 * 1024 * 1024) { toast.error('Image must be under 5 MB'); return }
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  async function uploadImage() {
    if (!imageFile) return form.item_image_url || null
    setUploading(true)
    const ext = imageFile.name.split('.').pop()
    const path = `items/${crypto.randomUUID()}.${ext}`
    const { error: uploadError } = await supabase.storage.from('store-media').upload(path, imageFile)
    setUploading(false)
    if (uploadError) {
      toast.error('Image upload failed: ' + uploadError.message)
      return null
    }
    const { data: { publicUrl } } = supabase.storage.from('store-media').getPublicUrl(path)
    return publicUrl
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!form.name.trim()) { toast.error('Name is required'); return }
    setSaving(true)

    const imageUrl = await uploadImage()
    if (imageFile && imageUrl === null) { setSaving(false); return }

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      category: form.category,
      unit: form.unit,
      is_active: form.is_active,
      item_image_url: imageUrl || form.item_image_url || null,
      min_qty: form.min_qty !== '' ? Number(form.min_qty) : 0,
      max_qty: form.max_qty !== '' ? Number(form.max_qty) : null,
    }

    let error
    if (editingId) {
      ;({ error } = await supabase.from('store_items').update(payload).eq('id', editingId))
    } else {
      ;({ error } = await supabase.from('store_items').insert([{ ...payload, created_by: profile.id }]))
    }

    setSaving(false)
    if (error) {
      toast.error('Save failed: ' + error.message)
    } else {
      toast.success(editingId ? 'Item updated!' : 'Item added!')
      closeModal()
      fetchItems()
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <h1 className="page-header flex items-center gap-2">
            <Tag size={24} className="text-brand-600" />
            {t('items.title')}
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">{t('items.subtitle')}</p>
        </div>
        {canWrite && (
          <button
            onClick={openAdd}
            className="flex items-center gap-2 bg-brand-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-600 transition-colors flex-shrink-0"
          >
            <Plus size={16} />
            {t('items.addItem')}
          </button>
        )}
      </div>

      {/* Search + Refresh */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            className="w-full pl-9 pr-9 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40"
            placeholder={t('items.searchPlaceholder')}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X size={14} />
            </button>
          )}
        </div>
        <button
          onClick={fetchItems}
          className="p-2.5 border border-gray-300 rounded-lg text-gray-500 hover:bg-gray-50 transition-colors"
          title="Refresh"
        >
          <RefreshCw size={16} />
        </button>
      </div>

      {/* Category Filter Pills */}
      <div className="flex flex-wrap gap-2 mb-6">
        {['all', ...CATEGORIES].map(cat => (
          <button
            key={cat}
            onClick={() => setCatFilter(cat)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold capitalize transition-colors border ${
              catFilter === cat
                ? 'bg-brand-500 text-white border-brand-500'
                : 'bg-white text-gray-600 border-gray-300 hover:border-brand-400 hover:text-brand-600'
            }`}
          >
            {cat === 'all' ? t('common.all') : cat}
          </button>
        ))}
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400">
          <RefreshCw size={20} className="animate-spin mr-2" />
          {t('common.loading')}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 flex flex-col items-center justify-center py-16 text-center">
          <Package size={40} className="text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium mb-1">
            {items.length === 0 ? t('items.noItems') : t('items.noResults')}
          </p>
          <p className="text-gray-400 text-sm">
            {items.length === 0 ? t('items.addFirstItem') : t('items.adjustFilter')}
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {filtered.map(item => (
              <div
                key={item.id}
                onClick={() => canWrite && openEdit(item)}
                className={`bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden transition-all ${
                  canWrite ? 'cursor-pointer hover:shadow-md hover:border-brand-300' : ''
                } ${!item.is_active ? 'opacity-60' : ''}`}
              >
                {/* Image */}
                <div className="aspect-square bg-gray-50 flex items-center justify-center overflow-hidden">
                  {item.item_image_url ? (
                    <img
                      src={item.item_image_url}
                      alt={item.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Image size={36} className="text-gray-300" />
                  )}
                </div>
                {/* Info */}
                <div className="p-2.5">
                  <p className="text-xs font-semibold text-gray-900 truncate leading-snug mb-1" title={item.name}>
                    {item.name}
                  </p>
                  <div className="flex items-center justify-between gap-1 flex-wrap">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${CATEGORY_BADGE[item.category] || CATEGORY_BADGE.Other}`}>
                      {item.category}
                    </span>
                    <span className="text-xs text-gray-400">{item.unit}</span>
                  </div>
                  {!item.is_active && (
                    <span className="text-xs text-gray-400 mt-1 block">{t('items.inactive')}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-4">
            {filtered.length} item{filtered.length !== 1 ? 's' : ''}
            {catFilter !== 'all' || search ? ` (filtered from ${items.length})` : ''}
          </p>
        </>
      )}

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingId ? t('items.editItem') : t('items.addItem')}
              </h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSave} className="px-6 py-5 space-y-4">
              {/* Item Photo */}
              <div>
                <label className="label">{t('items.itemPhoto')}</label>
                <div className="flex items-start gap-4">
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="w-24 h-24 rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center cursor-pointer hover:border-brand-400 overflow-hidden flex-shrink-0 bg-gray-50"
                  >
                    {imagePreview ? (
                      <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <Image size={28} className="text-gray-300" />
                    )}
                  </div>
                  <div className="flex-1 pt-1">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-sm text-brand-600 hover:text-brand-700 font-medium"
                    >
                      {imagePreview ? t('items.changePhoto') : t('items.uploadPhoto')}
                    </button>
                    <p className="text-xs text-gray-400 mt-1">{t('items.photoHint')}</p>
                    {imagePreview && (
                      <button
                        type="button"
                        onClick={() => { setImageFile(null); setImagePreview(''); setForm(f => ({ ...f, item_image_url: '' })) }}
                        className="text-xs text-red-500 hover:text-red-600 mt-1"
                      >
                        {t('items.removePhoto')}
                      </button>
                    )}
                  </div>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageSelect}
                />
              </div>

              {/* Name */}
              <div>
                <label className="label">{t('items.itemName')}</label>
                <input
                  required
                  className="input"
                  placeholder="e.g. M8 Hex Bolt"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                />
              </div>

              {/* Description */}
              <div>
                <label className="label">{t('items.description')}</label>
                <textarea
                  className="input resize-none"
                  rows={2}
                  placeholder={t('items.descriptionPlaceholder')}
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                />
              </div>

              {/* Category + Unit */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">{t('items.category')}</label>
                  <select
                    className="input"
                    value={form.category}
                    onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  >
                    {CATEGORIES.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">{t('items.unit')}</label>
                  <select
                    className="input"
                    value={form.unit}
                    onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
                  >
                    {UNITS.map(u => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Reorder levels */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Min. Stock (Reorder Level)</label>
                  <div className="flex">
                    <input
                      type="number" min="0" step="any"
                      className="input rounded-r-none"
                      placeholder="0"
                      value={form.min_qty}
                      onChange={e => setForm(f => ({ ...f, min_qty: e.target.value }))}
                    />
                    <span className="inline-flex items-center px-3 border border-l-0 border-gray-300 bg-gray-50 text-gray-500 rounded-r-lg text-sm whitespace-nowrap">
                      {form.unit || 'unit'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Alert when stock falls below this</p>
                </div>
                <div>
                  <label className="label">Max. Stock (Optional)</label>
                  <div className="flex">
                    <input
                      type="number" min="0" step="any"
                      className="input rounded-r-none"
                      placeholder="—"
                      value={form.max_qty}
                      onChange={e => setForm(f => ({ ...f, max_qty: e.target.value }))}
                    />
                    <span className="inline-flex items-center px-3 border border-l-0 border-gray-300 bg-gray-50 text-gray-500 rounded-r-lg text-sm whitespace-nowrap">
                      {form.unit || 'unit'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Maximum stock to keep</p>
                </div>
              </div>

              {/* Active toggle */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, is_active: !f.is_active }))}
                  className="flex items-center gap-2 text-sm text-gray-700"
                >
                  {form.is_active ? (
                    <ToggleRight size={28} className="text-brand-600" />
                  ) : (
                    <ToggleLeft size={28} className="text-gray-400" />
                  )}
                  {form.is_active ? t('common.active') : t('common.inactive')}
                </button>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={saving || uploading}
                  className="flex-1 bg-brand-500 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-brand-600 disabled:opacity-60 transition-colors"
                >
                  {uploading ? t('items.uploading') : saving ? t('items.saving') : editingId ? t('items.updateItem') : t('items.addItem')}
                </button>
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 border border-gray-300 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

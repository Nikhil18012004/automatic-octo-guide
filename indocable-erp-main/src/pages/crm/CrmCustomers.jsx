import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../supabase'
import toast from 'react-hot-toast'
import {
  Search, RefreshCw, UserPlus, Phone, Mail, ChevronRight, X, Building2,
} from 'lucide-react'
import { gradient } from '../../lib/format'
import { initials } from '../../lib/crm'

function AddCustomerModal({ onClose, onSaved }) {
  const [form, setForm] = useState({ name: '', phone: '', email: '', address: '', gst_number: '' })
  const [saving, setSaving] = useState(false)
  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function save() {
    if (!form.name.trim()) { toast.error('Name is required'); return }
    setSaving(true)
    const { error } = await supabase.from('customers').insert({
      name: form.name.trim(), phone: form.phone || null, email: form.email || null,
      address: form.address || null, gst_number: form.gst_number || null,
    })
    setSaving(false)
    if (error) { toast.error(error.message); return }
    toast.success('Customer added')
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md my-6">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <span className="font-bold text-gray-800">Add Customer</span>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 cursor-pointer"><X size={16} /></button>
        </div>
        <div className="px-5 py-4 space-y-3">
          {[['name', 'Customer / Firm name *'], ['phone', 'Phone'], ['email', 'Email'], ['address', 'Address'], ['gst_number', 'GST number']].map(([k, label]) => (
            <div key={k}>
              <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
              <input value={form[k]} onChange={e => setF(k, e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent" />
            </div>
          ))}
        </div>
        <div className="px-5 py-4 border-t border-gray-100 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 cursor-pointer">Cancel</button>
          <button onClick={save} disabled={saving} className="px-5 py-2 bg-brand-500 text-white rounded-xl text-sm font-semibold hover:bg-brand-600 cursor-pointer disabled:opacity-50">
            {saving ? 'Saving…' : 'Add Customer'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function CrmCustomers() {
  const navigate = useNavigate()
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')
  const [showAdd, setShowAdd] = useState(false)

  useEffect(() => { fetchCustomers() }, [])

  async function fetchCustomers() {
    setLoading(true)
    const { data, error } = await supabase.from('customers').select('*').order('name')
    if (error) toast.error(error.message)
    setCustomers(data || [])
    setLoading(false)
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return customers
    return customers.filter(c =>
      c.name?.toLowerCase().includes(q) ||
      c.phone?.includes(q) ||
      c.email?.toLowerCase().includes(q) ||
      (c.tags || []).some(t => t.toLowerCase().includes(q)))
  }, [customers, search])

  return (
    <div className="space-y-5">
      {showAdd && <AddCustomerModal onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); fetchCustomers() }} />}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-header">Customers</h1>
          <p className="text-sm text-gray-500 mt-0.5">{customers.length} accounts</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, phone, tag…"
              className="pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent w-56" />
          </div>
          <button onClick={fetchCustomers} className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl cursor-pointer"><RefreshCw size={16} /></button>
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-4 py-2 bg-brand-500 text-white rounded-xl text-sm font-semibold hover:bg-brand-600 cursor-pointer">
            <UserPlus size={15} /> Add
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400 text-sm">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="card p-16 text-center">
          <Building2 size={40} className="mx-auto text-gray-200 mb-3" />
          <p className="text-gray-400 font-medium">{search ? 'No matches' : 'No customers yet'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(c => (
            <button key={c.id} onClick={() => navigate(`/crm/customers/${c.id}`)}
              className="card p-4 text-left hover:shadow-md hover:border-brand-200 transition-all cursor-pointer flex items-center gap-3 group">
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${gradient(c.name)} flex items-center justify-center flex-shrink-0`}>
                <span className="text-white text-sm font-bold">{initials(c.name)}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-gray-900 text-sm truncate">{c.name}</div>
                <div className="flex items-center gap-3 mt-0.5 text-[11px] text-gray-400">
                  {c.phone && <span className="flex items-center gap-1"><Phone size={10} />{c.phone}</span>}
                  {c.email && <span className="flex items-center gap-1 truncate"><Mail size={10} />{c.email}</span>}
                </div>
                {(c.tags || []).length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {c.tags.slice(0, 3).map(t => <span key={t} className="text-[9px] font-semibold bg-brand-50 text-brand-600 border border-brand-100 rounded px-1.5 py-0.5">{t}</span>)}
                  </div>
                )}
              </div>
              <ChevronRight size={16} className="text-gray-300 group-hover:text-brand-400 flex-shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

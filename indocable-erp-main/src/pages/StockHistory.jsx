import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../supabase'
import { TrendingUp, TrendingDown, Search, ClipboardList, X, MapPin } from 'lucide-react'
import AccessDenied from '../components/AccessDenied'

const DATE_FILTERS = [
  { id: 'today', label: 'Today' },
  { id: '7d',   label: '7 Days' },
  { id: '30d',  label: '30 Days' },
  { id: 'all',  label: 'All' },
]

function fromDate(filter) {
  if (filter === 'today') {
    const d = new Date(); d.setHours(0, 0, 0, 0); return d.toISOString().slice(0, 10)
  }
  if (filter === '7d')  return new Date(Date.now() - 7  * 86400000).toISOString().slice(0, 10)
  if (filter === '30d') return new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
  return null
}

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function StockHistory({ profile }) {
  if (!['owner', 'admin', 'operator', 'production_head'].includes(profile.role)) return <AccessDenied />

  const [receipts,    setReceipts]    = useState([])
  const [issues,      setIssues]      = useState([])
  const [tab,         setTab]         = useState('receipts')
  const [search,      setSearch]      = useState('')
  const [dateFilter,  setDateFilter]  = useState('30d')
  const [loading,     setLoading]     = useState(true)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    const [{ data: r }, { data: i }] = await Promise.all([
      supabase.from('stock_receipts').select('*, materials(name, unit)').order('receipt_date', { ascending: false }).order('created_at', { ascending: false }).limit(500),
      supabase.from('stock_issues').select('*, materials(name, unit)').order('issue_date', { ascending: false }).order('created_at', { ascending: false }).limit(500),
    ])
    setReceipts(r || [])
    setIssues(i || [])
    setLoading(false)
  }

  const data = tab === 'receipts' ? receipts : issues
  const dateField = tab === 'receipts' ? 'receipt_date' : 'issue_date'

  const filtered = useMemo(() => {
    const cutoff = fromDate(dateFilter)
    return data.filter(row => {
      const dateVal = row[dateField] || (row.created_at || '').slice(0, 10)
      if (cutoff && dateVal < cutoff) return false
      if (!search) return true
      const mat = (row.materials?.name || '').toLowerCase()
      const other = tab === 'receipts'
        ? (row.supplier_name || '').toLowerCase()
        : (row.issued_to || '').toLowerCase()
      const q = search.toLowerCase()
      return mat.includes(q) || other.includes(q)
    })
  }, [data, dateFilter, search, tab, dateField])

  const totalQty = useMemo(
    () => filtered.reduce((s, r) => s + (parseFloat(r.quantity) || 0), 0),
    [filtered]
  )

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center">
          <ClipboardList size={20} className="text-slate-600" />
        </div>
        <div>
          <h1 className="page-header">Stock History</h1>
          <p className="page-sub">Full log of all stock movements</p>
        </div>
      </div>

      {/* Tabs + date filters row */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        {/* Type tabs */}
        <div className="flex gap-1 p-1 bg-gray-100 rounded-xl">
          <button
            onClick={() => setTab('receipts')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-150 cursor-pointer ${
              tab === 'receipts'
                ? 'bg-white text-emerald-700 shadow-sm border border-emerald-100'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <TrendingUp size={14} className={tab === 'receipts' ? 'text-emerald-500' : ''} />
            Stock In
            <span className={`text-[11px] px-1.5 py-0.5 rounded-md font-bold ${tab === 'receipts' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-500'}`}>
              {receipts.length}
            </span>
          </button>
          <button
            onClick={() => setTab('issues')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-150 cursor-pointer ${
              tab === 'issues'
                ? 'bg-white text-brand-700 shadow-sm border border-brand-100'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <TrendingDown size={14} className={tab === 'issues' ? 'text-brand-500' : ''} />
            Stock Out
            <span className={`text-[11px] px-1.5 py-0.5 rounded-md font-bold ${tab === 'issues' ? 'bg-brand-100 text-brand-700' : 'bg-gray-200 text-gray-500'}`}>
              {issues.length}
            </span>
          </button>
        </div>

        {/* Date filter pills */}
        <div className="flex gap-1.5 ml-auto">
          {DATE_FILTERS.map(f => (
            <button
              key={f.id}
              onClick={() => setDateFilter(f.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                dateFilter === f.id
                  ? 'bg-gray-800 text-white border-gray-800'
                  : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:text-gray-700'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary stats */}
      {!loading && filtered.length > 0 && (
        <div className={`flex items-center gap-6 px-5 py-3.5 rounded-2xl border text-sm ${
          tab === 'receipts'
            ? 'bg-emerald-50 border-emerald-100'
            : 'bg-brand-50 border-brand-100'
        }`}>
          <div>
            <span className={`text-xs font-semibold uppercase tracking-wide ${tab === 'receipts' ? 'text-emerald-600' : 'text-brand-600'}`}>
              {tab === 'receipts' ? 'Total Received' : 'Total Issued'}
            </span>
            <div className={`text-xl font-bold tabular-nums mt-0.5 ${tab === 'receipts' ? 'text-emerald-800' : 'text-brand-800'}`}>
              {totalQty % 1 === 0 ? totalQty.toLocaleString('en-IN') : totalQty.toFixed(2)}
              <span className="text-sm font-medium ml-1 opacity-60">units</span>
            </div>
          </div>
          <div className={`w-px h-8 ${tab === 'receipts' ? 'bg-emerald-200' : 'bg-brand-200'}`} />
          <div>
            <span className={`text-xs font-semibold uppercase tracking-wide ${tab === 'receipts' ? 'text-emerald-600' : 'text-brand-600'}`}>
              Transactions
            </span>
            <div className={`text-xl font-bold tabular-nums mt-0.5 ${tab === 'receipts' ? 'text-emerald-800' : 'text-brand-800'}`}>
              {filtered.length}
            </div>
          </div>
          <div className="ml-auto">
            <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg ${
              tab === 'receipts' ? 'bg-emerald-100 text-emerald-700' : 'bg-brand-100 text-brand-700'
            }`}>
              {DATE_FILTERS.find(f => f.id === dateFilter)?.label}
            </span>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        <input
          className="input pl-10 pr-9"
          placeholder={tab === 'receipts' ? 'Search by material or supplier…' : 'Search by material or recipient…'}
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="card p-6 space-y-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex gap-3">
              <div className="skeleton h-9 w-24" />
              <div className="skeleton h-9 flex-1" />
              <div className="skeleton h-9 w-20" />
              <div className="skeleton h-9 w-32" />
            </div>
          ))}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            {tab === 'receipts' ? (
              <table className="w-full text-sm">
                <thead className="border-b border-gray-100" style={{ background: '#fafafa' }}>
                  <tr>
                    <th className="th">Date</th>
                    <th className="th">Material</th>
                    <th className="th-r">Qty Received</th>
                    <th className="th">Supplier</th>
                    <th className="th">Invoice</th>
                    <th className="th">Lot</th>
                    <th className="th">Location</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-14 text-center">
                        <TrendingUp size={28} className="mx-auto text-gray-200 mb-2" />
                        <p className="text-gray-400 font-medium text-sm">No stock receipts{search ? ' matching your search' : ` in the last ${DATE_FILTERS.find(f=>f.id===dateFilter)?.label.toLowerCase()}`}</p>
                      </td>
                    </tr>
                  ) : filtered.map(r => (
                    <tr key={r.id} className="hover:bg-emerald-50/30 transition-colors">
                      <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{fmtDate(r.receipt_date)}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">{r.materials?.name}</td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-bold text-emerald-700">+{r.quantity}</span>
                        <span className="text-gray-400 text-xs ml-1">{r.materials?.unit}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-500">{r.supplier_name || '—'}</td>
                      <td className="px-4 py-3 text-gray-500 font-mono text-xs">{r.invoice_number || '—'}</td>
                      <td className="px-4 py-3 text-gray-500 font-mono text-xs">{r.lot_number || '—'}</td>
                      <td className="px-4 py-3">
                        {r.location_code
                          ? <span className="inline-flex items-center gap-1 text-xs font-mono font-semibold text-brand-700 bg-brand-50 px-2 py-0.5 rounded-md">
                              <MapPin size={10} />{r.location_code}
                            </span>
                          : <span className="text-gray-300 text-xs">—</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table className="w-full text-sm">
                <thead className="border-b border-gray-100" style={{ background: '#fafafa' }}>
                  <tr>
                    <th className="th">Date</th>
                    <th className="th">Material</th>
                    <th className="th-r">Qty Issued</th>
                    <th className="th">Purpose</th>
                    <th className="th">Issued To</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-14 text-center">
                        <TrendingDown size={28} className="mx-auto text-gray-200 mb-2" />
                        <p className="text-gray-400 font-medium text-sm">No stock issues{search ? ' matching your search' : ` in the last ${DATE_FILTERS.find(f=>f.id===dateFilter)?.label.toLowerCase()}`}</p>
                      </td>
                    </tr>
                  ) : filtered.map(r => (
                    <tr key={r.id} className="hover:bg-brand-50/30 transition-colors">
                      <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{fmtDate(r.issue_date)}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">{r.materials?.name}</td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-bold text-brand-600">−{r.quantity}</span>
                        <span className="text-gray-400 text-xs ml-1">{r.materials?.unit}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-500">{r.purpose || '—'}</td>
                      <td className="px-4 py-3 text-gray-500">{r.issued_to || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {filtered.length > 0 && (
            <div className="px-5 py-3 border-t border-gray-50 flex items-center justify-between">
              <span className="text-xs text-gray-400">{filtered.length} records</span>
              {data.length > filtered.length && (
                <button onClick={() => setDateFilter('all')} className="text-xs text-brand-600 font-semibold hover:underline cursor-pointer">
                  Show all {data.length} →
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

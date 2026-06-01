import { useEffect, useState, useCallback, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../supabase'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'
import {
  History, Search, X, RefreshCw, Image, CheckCircle2, Clock,
  PackagePlus, PackageMinus, ZoomIn, Undo2, ClipboardCheck,
} from 'lucide-react'

const TXN_BADGE = {
  purchase:   null,
  return:     { label: 'Return',     cls: 'bg-blue-100 text-blue-700',   Icon: Undo2 },
  adjustment: { label: 'Adjustment', cls: 'bg-purple-100 text-purple-700', Icon: ClipboardCheck },
}

const PURPOSE_BADGE = {
  production:  null,
  maintenance: { label: 'Maintenance', cls: 'bg-sky-100 text-sky-700' },
  sample:      { label: 'Sample',      cls: 'bg-teal-100 text-teal-700' },
  scrap:       { label: 'Scrap',       cls: 'bg-red-100 text-red-700' },
  adjustment:  { label: 'Adjustment',  cls: 'bg-purple-100 text-purple-700' },
  other:       { label: 'Other',       cls: 'bg-gray-100 text-gray-600' },
}

function formatDate(str) {
  if (!str) return '—'
  return new Date(str).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

function VerifiedChip({ verifiedAt }) {
  const { t } = useTranslation()
  if (verifiedAt) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">
        <CheckCircle2 size={11} />
        {t('history.verifiedChip')}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-700">
      <Clock size={11} />
      {t('history.pendingChip')}
    </span>
  )
}

export default function StoreHistory({ profile }) {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState('receipts')
  const [receipts, setReceipts] = useState([])
  const [issues, setIssues] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [lightboxUrl, setLightboxUrl] = useState(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [{ data: receiptData, error: rErr }, { data: issueData, error: iErr }] = await Promise.all([
      supabase
        .from('store_receipts')
        .select(`
          id, receipt_date, quantity, unit_price, bill_no, bill_image_url,
          location_code, verified_at, created_at, txn_type,
          store_items(name, unit, item_image_url),
          received_by_profile:received_by(full_name),
          verified_by_profile:verified_by(full_name)
        `)
        .order('created_at', { ascending: false }),
      supabase
        .from('store_issues')
        .select(`
          id, issue_date, quantity, purpose, issued_to_name,
          location_from, notes, created_at, purpose_type,
          store_items(name, unit, item_image_url),
          issued_by_profile:issued_by(full_name)
        `)
        .order('created_at', { ascending: false }),
    ])

    if (rErr) toast.error('Failed to load receipts: ' + rErr.message)
    if (iErr) toast.error('Failed to load issues: ' + iErr.message)

    setReceipts(receiptData || [])
    setIssues(issueData || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // Focus/highlight a movement when opened from the Code Monitor
  const [searchParams] = useSearchParams()
  const focusParam = searchParams.get('focus') // e.g. "store_receipts:123"
  const [focusTable, focusId] = focusParam ? focusParam.split(':') : [null, null]
  const focusRef = useRef(null)

  useEffect(() => {
    if (!focusParam) return
    setActiveTab(focusTable === 'store_issues' ? 'issues' : 'receipts')
  }, [focusParam, focusTable])

  useEffect(() => {
    if (!focusId || loading) return
    const id = setTimeout(() => focusRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 200)
    return () => clearTimeout(id)
  }, [focusId, loading, activeTab, receipts, issues])

  const isFocused = (table, id) => focusTable === table && String(id) === String(focusId)

  function matchesSearch(record, nameField = 'store_items') {
    const name = (record[nameField]?.name || '').toLowerCase()
    return name.includes(search.toLowerCase())
  }

  function matchesDate(record, dateField) {
    const d = record[dateField]?.split('T')[0] || record[dateField] || ''
    if (dateFrom && d < dateFrom) return false
    if (dateTo && d > dateTo) return false
    return true
  }

  const filteredReceipts = receipts.filter(r =>
    matchesSearch(r) && matchesDate(r, 'receipt_date')
  )

  const filteredIssues = issues.filter(i =>
    matchesSearch(i) && matchesDate(i, 'issue_date')
  )

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <h1 className="page-header flex items-center gap-2">
            <History size={24} className="text-brand-600" />
            {t('history.title')}
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">{t('history.subtitle')}</p>
        </div>
        <button
          onClick={fetchData}
          className="p-2.5 border border-gray-300 rounded-lg text-gray-500 hover:bg-gray-50 transition-colors flex-shrink-0"
          title="Refresh"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="relative flex-1 min-w-48 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
          <input
            className="w-full pl-9 pr-9 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40"
            placeholder={t('history.searchPlaceholder')}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X size={14} />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            title="From date"
          />
          <span className="text-gray-400 text-sm">{t('history.to')}</span>
          <input
            type="date"
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            title="To date"
          />
          {(dateFrom || dateTo) && (
            <button
              onClick={() => { setDateFrom(''); setDateTo('') }}
              className="text-gray-400 hover:text-gray-600 p-1"
              title="Clear dates"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-gray-100 rounded-xl p-1 w-fit">
        <button
          onClick={() => setActiveTab('receipts')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'receipts'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          <PackagePlus size={15} className="text-green-500" />
          {t('history.receiptsIn')}
          {!loading && (
            <span className="bg-gray-200 text-gray-600 rounded-full px-2 py-0.5 text-xs">
              {filteredReceipts.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('issues')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'issues'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          <PackageMinus size={15} className="text-orange-500" />
          {t('history.issuesOut')}
          {!loading && (
            <span className="bg-gray-200 text-gray-600 rounded-full px-2 py-0.5 text-xs">
              {filteredIssues.length}
            </span>
          )}
        </button>
      </div>

      {/* Receipts Tab */}
      {activeTab === 'receipts' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-gray-400">
              <RefreshCw size={18} className="animate-spin mr-2" />
              {t('common.loading')}
            </div>
          ) : filteredReceipts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <PackagePlus size={36} className="text-gray-300 mb-3" />
              <p className="text-gray-500 font-medium mb-1">{t('history.noReceipts')}</p>
              <p className="text-gray-400 text-sm">{t('history.adjustFilters')}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">{t('common.date')}</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">{t('common.item')}</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">{t('common.qty')}</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">{t('history.unitPrice')}</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">Type</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">{t('history.billNo')}</th>
                    <th className="text-center px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">{t('history.bill')}</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">{t('common.location')}</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">{t('history.receivedBy')}</th>
                    <th className="text-center px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">{t('history.verified')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredReceipts.map(r => (
                    <tr key={r.id}
                      ref={isFocused('store_receipts', r.id) ? focusRef : null}
                      className={`transition-colors ${isFocused('store_receipts', r.id) ? 'bg-brand-50 ring-2 ring-inset ring-brand-400' : 'hover:bg-gray-50'}`}>
                      <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                        {formatDate(r.receipt_date)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                            {r.store_items?.item_image_url
                              ? <img src={r.store_items.item_image_url} alt="" className="w-full h-full object-cover" />
                              : <Image size={12} className="text-gray-300" />
                            }
                          </div>
                          <span className="font-medium text-gray-900 truncate max-w-[160px]">
                            {r.store_items?.name || '—'}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900 whitespace-nowrap">
                        {r.quantity}
                        <span className="text-gray-400 font-normal text-xs ml-1">{r.store_items?.unit || ''}</span>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700 whitespace-nowrap">
                        {r.unit_price ? `₹${Number(r.unit_price).toLocaleString('en-IN')}` : '—'}
                      </td>
                      <td className="px-4 py-3">
                        {(() => {
                          const badge = TXN_BADGE[r.txn_type]
                          if (!badge) return <span className="text-xs text-gray-400">Purchase</span>
                          const { Icon } = badge
                          return (
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${badge.cls}`}>
                              <Icon size={10} /> {badge.label}
                            </span>
                          )
                        })()}
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {r.bill_no || '—'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {r.bill_image_url ? (
                          <button
                            onClick={() => setLightboxUrl(r.bill_image_url)}
                            className="w-9 h-9 rounded-lg overflow-hidden border border-gray-200 hover:border-brand-400 transition-colors mx-auto block relative group"
                            title="View bill image"
                          >
                            <img src={r.bill_image_url} alt="Bill" className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 flex items-center justify-center transition-all">
                              <ZoomIn size={14} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                          </button>
                        ) : (
                          <span className="text-gray-300 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500 font-mono text-xs whitespace-nowrap">
                        {r.location_code || '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                        {r.received_by_profile?.full_name || '—'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <VerifiedChip verifiedAt={r.verified_at} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {!loading && filteredReceipts.length > 0 && (
            <div className="px-4 py-2.5 border-t border-gray-100 text-xs text-gray-400">
              {filteredReceipts.length} receipt{filteredReceipts.length !== 1 ? 's' : ''}
              {(search || dateFrom || dateTo) ? ` (filtered from ${receipts.length})` : ''}
            </div>
          )}
        </div>
      )}

      {/* Issues Tab */}
      {activeTab === 'issues' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-gray-400">
              <RefreshCw size={18} className="animate-spin mr-2" />
              {t('common.loading')}
            </div>
          ) : filteredIssues.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <PackageMinus size={36} className="text-gray-300 mb-3" />
              <p className="text-gray-500 font-medium mb-1">{t('history.noIssues')}</p>
              <p className="text-gray-400 text-sm">{t('history.adjustFilters')}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">{t('common.date')}</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">{t('common.item')}</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">{t('common.qty')}</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">Type</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">{t('common.purpose')}</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">{t('history.issuedTo')}</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">{t('history.locationFrom')}</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">{t('history.issuedBy')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredIssues.map(i => (
                    <tr key={i.id}
                      ref={isFocused('store_issues', i.id) ? focusRef : null}
                      className={`transition-colors ${isFocused('store_issues', i.id) ? 'bg-brand-50 ring-2 ring-inset ring-brand-400' : 'hover:bg-gray-50'}`}>
                      <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                        {formatDate(i.issue_date)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                            {i.store_items?.item_image_url
                              ? <img src={i.store_items.item_image_url} alt="" className="w-full h-full object-cover" />
                              : <Image size={12} className="text-gray-300" />
                            }
                          </div>
                          <span className="font-medium text-gray-900 truncate max-w-[160px]">
                            {i.store_items?.name || '—'}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900 whitespace-nowrap">
                        {i.quantity}
                        <span className="text-gray-400 font-normal text-xs ml-1">{i.store_items?.unit || ''}</span>
                      </td>
                      <td className="px-4 py-3">
                        {(() => {
                          const badge = PURPOSE_BADGE[i.purpose_type]
                          if (!badge) return <span className="text-xs text-gray-400">Production</span>
                          return (
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${badge.cls}`}>
                              {badge.label}
                            </span>
                          )
                        })()}
                      </td>
                      <td className="px-4 py-3 text-gray-700 max-w-xs">
                        <span className="truncate block">{i.purpose || '—'}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                        {i.issued_to_name || '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-500 font-mono text-xs whitespace-nowrap">
                        {i.location_from || '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                        {i.issued_by_profile?.full_name || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {!loading && filteredIssues.length > 0 && (
            <div className="px-4 py-2.5 border-t border-gray-100 text-xs text-gray-400">
              {filteredIssues.length} issue{filteredIssues.length !== 1 ? 's' : ''}
              {(search || dateFrom || dateTo) ? ` (filtered from ${issues.length})` : ''}
            </div>
          )}
        </div>
      )}

      {/* Bill Image Lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setLightboxUrl(null)}
        >
          <div
            className="relative max-w-3xl w-full max-h-[90vh] flex items-center justify-center"
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => setLightboxUrl(null)}
              className="absolute -top-4 -right-4 w-9 h-9 bg-white rounded-full flex items-center justify-center shadow-lg hover:bg-gray-100 z-10"
            >
              <X size={18} />
            </button>
            <img
              src={lightboxUrl}
              alt="Bill"
              className="max-w-full max-h-[85vh] rounded-xl shadow-2xl object-contain"
            />
          </div>
        </div>
      )}
    </div>
  )
}

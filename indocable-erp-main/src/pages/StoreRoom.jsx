import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../supabase'
import toast from 'react-hot-toast'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Warehouse, Package, PackagePlus, PackageMinus, ShieldAlert, CheckCircle2,
  Clock, RefreshCw, Image, AlertTriangle, History, ArrowRight, Undo2,
  ClipboardCheck, Bell, TrendingDown,
} from 'lucide-react'

const VERIFY_ROLES = ['owner', 'admin', 'security_guard']

function StockChip({ stock }) {
  if (stock <= 0)  return <span className="badge-red">Out of Stock</span>
  if (stock < 3)   return <span className="badge-amber">Low</span>
  return <span className="badge-green">In Stock</span>
}

export default function StoreRoom({ profile }) {
  const navigate   = useNavigate()
  const { t }      = useTranslation()
  const [items, setItems]                   = useState([])
  const [receipts, setReceipts]             = useState([])
  const [issues, setIssues]                 = useState([])
  const [pendingReceipts, setPendingReceipts] = useState([])
  const [loading, setLoading]               = useState(true)
  const [verifying, setVerifying]           = useState(null)

  const canVerify      = VERIFY_ROLES.includes(profile?.role)
  const isSecurityGuard = profile?.role === 'security_guard'

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const [
      { data: itemData },
      { data: receiptData },
      { data: issueData },
      { data: pendingData },
    ] = await Promise.all([
      supabase.from('store_items').select('*').order('name'),
      supabase.from('store_receipts').select('item_id, quantity, location_code, created_at'),
      supabase.from('store_issues').select('item_id, quantity'),
      supabase.from('store_receipts').select(`
        id, item_id, quantity, receipt_date, location_code, created_at,
        store_items(name, unit, item_image_url),
        received_by_profile:received_by(full_name)
      `).is('verified_at', null).order('created_at', { ascending: false }),
    ])
    setItems(itemData || [])
    setReceipts(receiptData || [])
    setIssues(issueData || [])
    setPendingReceipts(pendingData || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const today = new Date().toISOString().split('T')[0]
  const todayCount = receipts.filter(r => (r.created_at || '').startsWith(today)).length

  const stockMap = {}
  receipts.forEach(r => {
    if (!stockMap[r.item_id]) stockMap[r.item_id] = { in: 0, out: 0, lastLocation: null }
    stockMap[r.item_id].in += Number(r.quantity) || 0
    stockMap[r.item_id].lastLocation = r.location_code || stockMap[r.item_id].lastLocation
  })
  issues.forEach(i => {
    if (!stockMap[i.item_id]) stockMap[i.item_id] = { in: 0, out: 0, lastLocation: null }
    stockMap[i.item_id].out += Number(i.quantity) || 0
  })

  const pendingCount = pendingReceipts.length

  // Low stock: items where current stock < min_qty (and min_qty is set > 0)
  const lowStockItems = items.filter(item => {
    if (!item.min_qty || item.min_qty <= 0) return false
    const s = stockMap[item.id] || { in: 0, out: 0 }
    return (s.in - s.out) < item.min_qty
  })

  async function handleVerify(receiptId) {
    setVerifying(receiptId)
    const { error } = await supabase.from('store_receipts')
      .update({ verified_by: profile.id, verified_at: new Date().toISOString() })
      .eq('id', receiptId)
    setVerifying(null)
    if (error) toast.error('Verification failed: ' + error.message)
    else { toast.success('Receipt verified!'); fetchAll() }
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-brand-50 border border-brand-100 flex items-center justify-center">
            <Warehouse size={20} className="text-brand-600" />
          </div>
          <div>
            <h1 className="page-header">General Store</h1>
            <p className="page-sub">Tools, consumables &amp; spare parts — real-time stock</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
          <button onClick={() => navigate('/store/request?mode=inward')} className="btn-primary">
            <PackagePlus size={15} /> Store Inward
          </button>
          <button onClick={() => navigate('/store/request?mode=outward')} className="btn-secondary">
            <PackageMinus size={15} /> Store Outward
          </button>
          <button onClick={() => navigate('/store/return')} className="btn-ghost px-3 py-2 text-blue-600 border border-blue-200 bg-blue-50 hover:bg-blue-100 rounded-lg text-sm font-medium flex items-center gap-1.5">
            <Undo2 size={14} /> Return
          </button>
          <button onClick={fetchAll} className="btn-ghost px-2.5" title="Refresh">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Security guard alert */}
      {isSecurityGuard && pendingCount > 0 && (
        <div className="flex items-center gap-4 bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4">
          <ShieldAlert size={22} className="text-amber-500 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-semibold text-amber-800 text-sm">
              {t('store.receiptsNeedVerification', { count: pendingCount })}
            </p>
            <p className="text-xs text-amber-600 mt-0.5">{t('store.scrollToVerify')}</p>
          </div>
          <button
            onClick={() => document.getElementById('pending-section')?.scrollIntoView({ behavior: 'smooth' })}
            className="btn-primary text-xs px-3 py-2"
          >
            {t('store.verifyNow')}
          </button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { icon: Package,       label: 'Total Items',          value: items.length,         color: 'text-brand-500',   bg: 'bg-brand-50',   border: 'border-brand-100',   bold: false },
          { icon: Bell,          label: 'Low Stock Alerts',     value: lowStockItems.length, color: lowStockItems.length > 0 ? 'text-red-600' : 'text-slate-400', bg: lowStockItems.length > 0 ? 'bg-red-50' : 'bg-gray-50', border: lowStockItems.length > 0 ? 'border-red-200' : 'border-gray-100', bold: lowStockItems.length > 0 },
          { icon: PackagePlus,   label: 'Received Today',       value: todayCount,           color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100', bold: false },
          { icon: Clock,         label: 'Pending Verification', value: pendingCount,         color: pendingCount > 0 ? 'text-amber-600' : 'text-slate-400', bg: pendingCount > 0 ? 'bg-amber-50' : 'bg-gray-50', border: pendingCount > 0 ? 'border-amber-100' : 'border-gray-100', bold: pendingCount > 0 },
        ].map(({ icon: Icon, label, value, color, bg, border, bold }) => (
          <div key={label} className={`card border ${border} p-4`}>
            <div className={`w-8 h-8 rounded-xl ${bg} flex items-center justify-center mb-3`}>
              <Icon size={16} className={color} />
            </div>
            <div className={`text-2xl font-bold ${bold ? color : 'text-gray-900'}`}>{value}</div>
            <div className="text-xs font-medium text-gray-500 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* Low Stock Alert Panel */}
      {lowStockItems.length > 0 && (
        <div className="card border border-red-200 overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3.5 border-b border-red-100 bg-red-50">
            <Bell size={15} className="text-red-500" />
            <h2 className="font-semibold text-red-800 text-sm">
              {lowStockItems.length} item{lowStockItems.length !== 1 ? 's' : ''} need restocking
            </h2>
            <button
              onClick={() => navigate('/store/request?mode=inward')}
              className="ml-auto text-xs text-red-700 bg-red-100 hover:bg-red-200 px-3 py-1 rounded-lg font-semibold transition-colors"
            >
              Store Inward →
            </button>
          </div>
          <div className="divide-y divide-red-50">
            {lowStockItems.map(item => {
              const s = stockMap[item.id] || { in: 0, out: 0 }
              const stock = s.in - s.out
              const pct = item.min_qty > 0 ? Math.round((stock / item.min_qty) * 100) : 0
              return (
                <div key={item.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0 border border-gray-100">
                    {item.item_image_url
                      ? <img src={item.item_image_url} alt={item.name} className="w-full h-full object-cover" />
                      : <Image size={13} className="text-gray-300" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm truncate">{item.name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden max-w-24">
                        <div
                          className={`h-full rounded-full ${pct <= 0 ? 'bg-red-500' : 'bg-amber-400'}`}
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-400">{pct}%</span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className={`text-sm font-bold ${stock <= 0 ? 'text-red-600' : 'text-amber-600'}`}>
                      {stock} {item.unit}
                    </span>
                    <p className="text-xs text-gray-400">min: {item.min_qty}</p>
                  </div>
                  {stock <= 0 && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700 ml-1">OUT</span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Stock table */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900 text-sm">{t('store.stockOverview')}</h2>
          <button onClick={() => navigate('/store/items')}
            className="flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700 font-semibold transition-colors cursor-pointer">
            {t('store.viewCatalog')} <ArrowRight size={12} />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-14 text-gray-400 gap-2">
            <RefreshCw size={16} className="animate-spin" />
            <span className="text-sm">{t('common.loading')}</span>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-center">
            <Package size={36} className="text-gray-200 mb-3" />
            <p className="text-gray-500 font-medium text-sm">{t('store.noItemsInCatalog')}</p>
            <p className="text-gray-400 text-xs mt-1">{t('store.addItemsToSeeStock')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-100" style={{ background: '#fafafa' }}>
                <tr>
                  <th className="th w-10" />
                  <th className="th">{t('common.item')}</th>
                  <th className="th">{t('store.category')}</th>
                  <th className="th">{t('store.unit')}</th>
                  <th className="th-r">{t('store.inStock')}</th>
                  <th className="th">{t('store.lastLocation')}</th>
                  <th className="th" style={{ textAlign: 'center' }}>{t('common.status')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {items.map(item => {
                  const s = stockMap[item.id] || { in: 0, out: 0, lastLocation: null }
                  const stock = s.in - s.out
                  return (
                    <tr key={item.id} onClick={() => navigate('/store/items')}
                      className="hover:bg-brand-50/30 transition-colors cursor-pointer">
                      <td className="px-4 py-3">
                        <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center overflow-hidden border border-gray-100">
                          {item.item_image_url
                            ? <img src={item.item_image_url} alt={item.name} className="w-full h-full object-cover" />
                            : <Image size={13} className="text-gray-300" />}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-semibold text-gray-900 max-w-xs">
                        <span className="truncate block">{item.name}</span>
                        {!item.is_active && <span className="text-xs text-gray-400">{t('store.inactive')}</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="badge-gray">{item.category}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{item.unit}</td>
                      <td className="px-4 py-3 text-right font-bold text-gray-900">{stock}</td>
                      <td className="px-4 py-3 text-gray-400 font-mono text-xs">{s.lastLocation || '—'}</td>
                      <td className="px-4 py-3 text-center"><StockChip stock={stock} /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pending verification */}
      <div id="pending-section" className="card overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3.5 border-b border-gray-100">
          <Clock size={15} className="text-amber-500" />
          <h2 className="font-semibold text-gray-900 text-sm">{t('store.pendingSection')}</h2>
          {pendingCount > 0 && (
            <span className="ml-auto badge-amber">{t('store.pendingCount', { count: pendingCount })}</span>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-gray-400 gap-2">
            <RefreshCw size={16} className="animate-spin" />
            <span className="text-sm">{t('common.loading')}</span>
          </div>
        ) : pendingReceipts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <CheckCircle2 size={32} className="text-emerald-400 mb-3" />
            <p className="text-gray-600 font-semibold text-sm">{t('store.allVerified')}</p>
            <p className="text-gray-400 text-xs mt-1">{t('store.noPendingReceipts')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-amber-100" style={{ background: '#fffbeb' }}>
                <tr>
                  <th className="th text-amber-700">{t('common.item')}</th>
                  <th className="th-r text-amber-700">{t('common.qty')}</th>
                  <th className="th text-amber-700">{t('store.receivedDate')}</th>
                  <th className="th text-amber-700">{t('store.submittedBy')}</th>
                  <th className="th text-amber-700">{t('common.location')}</th>
                  {canVerify && <th className="th text-amber-700" style={{ textAlign: 'center' }}>{t('store.action')}</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {pendingReceipts.map(receipt => (
                  <tr key={receipt.id} className="hover:bg-amber-50/40 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0 border border-gray-100">
                          {receipt.store_items?.item_image_url
                            ? <img src={receipt.store_items.item_image_url} alt="" className="w-full h-full object-cover" />
                            : <Image size={12} className="text-gray-300" />}
                        </div>
                        <span className="font-semibold text-gray-900">{receipt.store_items?.name || '—'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-gray-900">
                      {receipt.quantity}
                      <span className="text-gray-400 font-normal text-xs ml-1">{receipt.store_items?.unit || ''}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">
                      {receipt.receipt_date
                        ? new Date(receipt.receipt_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{receipt.received_by_profile?.full_name || '—'}</td>
                    <td className="px-4 py-3 text-gray-400 font-mono text-xs">{receipt.location_code || '—'}</td>
                    {canVerify && (
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleVerify(receipt.id)}
                          disabled={verifying === receipt.id}
                          className="inline-flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-60 cursor-pointer mx-auto"
                        >
                          <CheckCircle2 size={12} />
                          {verifying === receipt.id ? t('store.verifying') : t('store.markVerified')}
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* History link */}
      <div className="flex justify-end">
        <button onClick={() => navigate('/store/history')}
          className="flex items-center gap-2 text-sm text-brand-600 hover:text-brand-700 font-semibold transition-colors cursor-pointer">
          <History size={15} /> {t('store.viewFullHistory')}
        </button>
      </div>
    </div>
  )
}

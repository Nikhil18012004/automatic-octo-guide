/**
 * Code Monitor — log of every gate code generated from Store Inward/Outward
 * and Return. Reads the browser-local code store (see lib/gateCodes.js).
 *
 * Each row links to its movement in the Movement Log: clicking relocates to
 * /store/history and highlights the matching entry.
 */

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ShieldCheck, RotateCcw, Clock, CheckCircle2, XCircle, ArrowDownToLine,
  ArrowUpFromLine, Undo2, ExternalLink,
} from 'lucide-react'
import AccessDenied from '../components/AccessDenied'
import { STORE_ROLES } from '../lib/storeRoles'
import { getCodes, onCodesChange } from '../lib/gateCodes'

const TYPE_BADGE = {
  inward:  { label: 'Inward',  cls: 'bg-green-100 text-green-700',   icon: <ArrowDownToLine size={12} /> },
  outward: { label: 'Outward', cls: 'bg-orange-100 text-orange-700', icon: <ArrowUpFromLine size={12} /> },
  return:  { label: 'Return',  cls: 'bg-blue-100 text-blue-700',     icon: <Undo2 size={12} /> },
}

const STATUS_BADGE = {
  active:  { label: 'Active',  cls: 'bg-blue-50 border-blue-200 text-blue-700',   icon: <Clock size={12} /> },
  used:    { label: 'Used',    cls: 'bg-green-50 border-green-200 text-green-700', icon: <CheckCircle2 size={12} /> },
  expired: { label: 'Expired', cls: 'bg-gray-50 border-gray-200 text-gray-500',   icon: <XCircle size={12} /> },
}

export default function StoreRequests({ profile }) {
  if (!STORE_ROLES.STORE_VIEW.includes(profile?.role)) return <AccessDenied />
  return <StoreRequestsInner profile={profile} />
}

function StoreRequestsInner({ profile }) {

  const navigate = useNavigate()
  const [codes, setCodes] = useState(getCodes())
  const [typeFilter, setTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

  useEffect(() => {
    const refresh = () => setCodes(getCodes())
    refresh()
    const id = setInterval(refresh, 1000) // keep expiry/countdown fresh
    const off = onCodesChange(refresh)
    return () => { clearInterval(id); off() }
  }, [])

  const filtered = codes.filter(c =>
    (typeFilter === 'all' || c.type === typeFilter) &&
    (statusFilter === 'all' || c.status === statusFilter)
  )

  function fmtDate(iso) {
    if (!iso) return '—'
    return new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  function secsLeft(c) {
    if (c.status !== 'active') return null
    return Math.max(0, Math.floor((new Date(c.expires_at).getTime() - Date.now()) / 1000))
  }

  function openMovement(c) {
    if (c.movement_table && c.movement_id) {
      navigate(`/store/history?focus=${c.movement_table}:${c.movement_id}`)
    }
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-brand-100 p-2.5 rounded-xl">
          <ShieldCheck className="text-brand-600" size={22} />
        </div>
        <div>
          <h1 className="page-header">Code Monitor</h1>
          <p className="text-gray-500 text-sm mt-0.5">Every gate code generated — click a row to see it in the Movement Log</p>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap gap-4">
        <div>
          <label className="label text-xs">Type</label>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="input text-sm">
            <option value="all">All types</option>
            <option value="inward">Inward</option>
            <option value="outward">Outward</option>
            <option value="return">Return</option>
          </select>
        </div>
        <div>
          <label className="label text-xs">Status</label>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="input text-sm">
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="used">Used</option>
            <option value="expired">Expired</option>
          </select>
        </div>
        <div className="flex-1" />
        <button onClick={() => { setTypeFilter('all'); setStatusFilter('all') }}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors self-end">
          <RotateCcw size={16} /> Reset filters
        </button>
      </div>

      {/* Log table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-gray-400">No codes generated yet</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Used By</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Code</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Generated</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Item</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Location</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Type</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Status</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-700"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => {
                  const type = TYPE_BADGE[c.type] || TYPE_BADGE.inward
                  const status = STATUS_BADGE[c.status] || STATUS_BADGE.expired
                  const left = secsLeft(c)
                  return (
                    <tr key={c.id}
                      onClick={() => openMovement(c)}
                      className="border-b border-gray-200 hover:bg-brand-50/50 transition-colors cursor-pointer">
                      <td className="px-4 py-3">
                        {c.used_by
                          ? <span className="font-medium text-gray-900">{c.used_by}</span>
                          : <span className="text-gray-400">—</span>}
                        <p className="text-xs text-gray-400">by {c.generated_by_name || '—'}</p>
                      </td>
                      <td className="px-4 py-3">
                        <code className="text-base font-mono font-bold text-brand-600">{c.code}</code>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600">{fmtDate(c.generated_at)}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{c.item_name || '—'}</p>
                        <p className="text-xs text-gray-500">{c.quantity} {c.unit || ''}</p>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-700">{c.location || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded ${type.cls}`}>
                          {type.icon} {type.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded border ${status.cls} w-fit`}>
                          {status.icon} {status.label}
                          {left !== null && <span className="font-mono">· {Math.floor(left / 60)}:{(left % 60).toString().padStart(2, '0')}</span>}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {c.movement_id && <ExternalLink size={14} className="text-gray-400 inline" />}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Summary */}
      <div className="mt-6 grid grid-cols-3 gap-4">
        {['active', 'used', 'expired'].map(s => {
          const badge = STATUS_BADGE[s]
          const count = codes.filter(c => c.status === s).length
          return (
            <div key={s} className={`rounded-lg border p-4 ${badge.cls}`}>
              <div className="flex items-center gap-2 mb-2">
                {badge.icon}
                <p className="font-medium">{badge.label}</p>
              </div>
              <p className="text-2xl font-bold">{count}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

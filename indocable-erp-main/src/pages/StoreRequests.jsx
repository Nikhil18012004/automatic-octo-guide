/**
 * Store Gate Requests Dashboard
 * View all active/expired/used OTP codes and their status
 * 
 * Features:
 * - List all gate requests with status (unused, used, expired)
 * - Cancel pending requests (if unused and not expired)
 * - Filter by request type (deposit/withdraw)
 * - See request details and expiry times
 */

import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'
import {
  ShieldCheck, Filter, RotateCcw, Clock, CheckCircle2, XCircle, Trash2, Eye
} from 'lucide-react'
import AccessDenied from '../components/AccessDenied'
import { STORE_ROLES } from '../lib/storeRoles'

export default function StoreRequests({ profile }) {
  if (!STORE_ROLES.STORE_VIEW.includes(profile?.role)) {
    return <AccessDenied />
  }

  const { t } = useTranslation()
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all') // all | unused | used | expired
  const [typeFilter, setTypeFilter] = useState('all') // all | deposit | withdraw
  const [timeRemaining, setTimeRemaining] = useState({})

  // Fetch requests
  useEffect(() => {
    fetchRequests()
    const interval = setInterval(fetchRequests, 30000) // Refresh every 30 seconds
    return () => clearInterval(interval)
  }, [])

  async function fetchRequests() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('store_gate_requests')
        .select(`
          id,
          request_type,
          item_id,
          quantity,
          otp_code,
          status,
          expires_at,
          created_at,
          redeemed_at,
          notes,
          requested_by,
          receipt_id,
          issue_id,
          store_items (name, unit),
          profiles (full_name, role)
        `)
        .order('created_at', { ascending: false })
        .limit(100)

      if (error) throw error
      setRequests(data || [])
    } catch (err) {
      console.error('Error fetching requests:', err)
      toast.error('Failed to load requests')
    } finally {
      setLoading(false)
    }
  }

  // Update countdown timers
  useEffect(() => {
    const updateTimers = () => {
      const remaining = {}
      requests.forEach(req => {
        if (req.status === 'unused' && req.expires_at) {
          const now = new Date().getTime()
          const expires = new Date(req.expires_at).getTime()
          const diff = Math.max(0, Math.floor((expires - now) / 1000))
          remaining[req.id] = diff
        }
      })
      setTimeRemaining(remaining)
    }

    updateTimers()
    const interval = setInterval(updateTimers, 1000)
    return () => clearInterval(interval)
  }, [requests])

  // Cancel a request
  async function cancelRequest(requestId) {
    if (!window.confirm('Are you sure? This will expire the OTP code.')) return

    try {
      const { error } = await supabase
        .from('store_gate_requests')
        .update({ status: 'expired' })
        .eq('id', requestId)

      if (error) throw error
      toast.success('Request cancelled')
      fetchRequests()
    } catch (err) {
      console.error('Error cancelling request:', err)
      toast.error(err.message || 'Failed to cancel request')
    }
  }

  // Filter requests
  const filteredRequests = requests.filter(req => {
    const matchStatus = statusFilter === 'all' || req.status === statusFilter
    const matchType = typeFilter === 'all' || req.request_type === typeFilter
    return matchStatus && matchType
  })

  // Get status badge
  function getStatusBadge(status) {
    const badges = {
      unused: {
        bg: 'bg-blue-50',
        border: 'border-blue-200',
        text: 'text-blue-700',
        icon: <Clock size={14} />,
        label: 'Pending'
      },
      used: {
        bg: 'bg-green-50',
        border: 'border-green-200',
        text: 'text-green-700',
        icon: <CheckCircle2 size={14} />,
        label: 'Used'
      },
      expired: {
        bg: 'bg-gray-50',
        border: 'border-gray-200',
        text: 'text-gray-600',
        icon: <XCircle size={14} />,
        label: 'Expired'
      }
    }
    const badge = badges[status] || badges.expired
    return badge
  }

  function formatTime(iso) {
    if (!iso) return '—'
    const date = new Date(iso)
    return date.toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  function formatTimeRemaining(seconds) {
    if (!seconds) return '—'
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  if (loading && requests.length === 0) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-brand-100 p-2.5 rounded-xl">
            <ShieldCheck className="text-brand-600" size={22} />
          </div>
          <div>
            <h1 className="page-header">Loading…</h1>
          </div>
        </div>
        <div className="bg-white rounded-xl p-8 text-center text-gray-400">
          Loading store gate requests…
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-brand-100 p-2.5 rounded-xl">
          <ShieldCheck className="text-brand-600" size={22} />
        </div>
        <div>
          <h1 className="page-header">Store Gate Requests</h1>
          <p className="text-gray-500 text-sm mt-0.5">Monitor all OTP codes and their status</p>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap gap-4">
        <div>
          <label className="label text-xs">Status</label>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="input text-sm"
          >
            <option value="all">All statuses</option>
            <option value="unused">Pending</option>
            <option value="used">Used</option>
            <option value="expired">Expired</option>
          </select>
        </div>
        <div>
          <label className="label text-xs">Type</label>
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            className="input text-sm"
          >
            <option value="all">All types</option>
            <option value="deposit">Deposit (in)</option>
            <option value="withdraw">Withdraw (out)</option>
          </select>
        </div>
        <div className="flex-1" />
        <button
          onClick={() => { setStatusFilter('all'); setTypeFilter('all') }}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <RotateCcw size={16} />
          Reset filters
        </button>
      </div>

      {/* Requests table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {filteredRequests.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            No store gate requests found
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">OTP Code</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Type</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Item</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-700">Qty</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Requested By</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Created</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Time Left</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRequests.map(req => {
                  const status = getStatusBadge(req.status)
                  const isExpiringSoon = timeRemaining[req.id] !== undefined && timeRemaining[req.id] <= 60 && req.status === 'unused'
                  return (
                    <tr key={req.id} className={`border-b border-gray-200 hover:bg-gray-50 transition-colors ${isExpiringSoon ? 'bg-orange-50' : ''}`}>
                      <td className="px-4 py-3">
                        <code className="text-lg font-mono font-bold text-brand-600">{req.otp_code}</code>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2 py-1 rounded ${
                          req.request_type === 'deposit'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-orange-100 text-orange-700'
                        }`}>
                          {req.request_type === 'deposit' ? '↓ Deposit' : '↑ Withdraw'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-gray-900">{req.store_items?.name || '—'}</p>
                          <p className="text-xs text-gray-500">{req.store_items?.unit}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-medium">{req.quantity}</td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-gray-900">{req.profiles?.full_name || '—'}</p>
                          <p className="text-xs text-gray-500">{req.profiles?.role}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600">{formatTime(req.created_at)}</td>
                      <td className="px-4 py-3">
                        <div className={`flex items-center gap-2 text-xs font-medium px-2 py-1 rounded border ${status.bg} ${status.border} ${status.text} w-fit`}>
                          {status.icon}
                          {status.label}
                        </div>
                      </td>
                      <td className={`px-4 py-3 text-xs font-mono font-bold ${isExpiringSoon ? 'text-orange-700' : 'text-gray-600'}`}>
                        {formatTimeRemaining(timeRemaining[req.id])}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          {req.status === 'unused' && (
                            <button
                              onClick={() => cancelRequest(req.id)}
                              className="p-1.5 hover:bg-red-100 rounded text-red-600 transition-colors"
                              title="Cancel request"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                          {req.notes && (
                            <button
                              onClick={() => toast.success(`Note: ${req.notes}`)}
                              className="p-1.5 hover:bg-blue-100 rounded text-blue-600 transition-colors"
                              title="View notes"
                            >
                              <Eye size={14} />
                            </button>
                          )}
                        </div>
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
        {['unused', 'used', 'expired'].map(status => {
          const count = requests.filter(r => r.status === status).length
          const badge = getStatusBadge(status)
          return (
            <div key={status} className={`rounded-lg border ${badge.border} ${badge.bg} p-4`}>
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-lg ${badge.text}`}>{badge.icon}</span>
                <p className="font-medium text-gray-700">{badge.label}</p>
              </div>
              <p className={`text-2xl font-bold ${badge.text}`}>{count}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

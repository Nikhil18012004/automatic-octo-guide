import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../supabase'
import toast from 'react-hot-toast'
import {
  CheckSquare, Square, Plus, Trash2, RefreshCw, CalendarClock, AlertTriangle,
} from 'lucide-react'
import { fmtDate } from '../../lib/format'
import { isMissingSchema, TASK_PRIORITY } from '../../lib/crm'

const todayStr = () => new Date().toISOString().slice(0, 10)

export default function CrmTasks({ profile }) {
  const navigate = useNavigate()
  const [tasks, setTasks]     = useState([])
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter]   = useState('open') // open | done | all
  const [needSetup, setNeedSetup] = useState(false)

  const [form, setForm] = useState({ title: '', due_date: '', priority: 'normal', customer_id: '' })
  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [{ data: tk, error }, { data: cu }] = await Promise.all([
      supabase.from('crm_tasks').select('*, customers(id, name)').order('due_date', { ascending: true }),
      supabase.from('customers').select('id, name').order('name'),
    ])
    if (error && isMissingSchema(error)) setNeedSetup(true)
    else if (error) toast.error(error.message)
    setTasks(tk || [])
    setCustomers(cu || [])
    setLoading(false)
  }

  async function addTask() {
    if (!form.title.trim()) { toast.error('Task title is required'); return }
    const { error } = await supabase.from('crm_tasks').insert({
      title: form.title.trim(), due_date: form.due_date || null, priority: form.priority,
      customer_id: form.customer_id || null, created_by: profile.id,
    })
    if (error) { isMissingSchema(error) ? setNeedSetup(true) : toast.error(error.message); return }
    setForm({ title: '', due_date: '', priority: 'normal', customer_id: '' })
    toast.success('Task added'); fetchAll()
  }

  async function toggle(t) {
    const done = t.status !== 'done'
    setTasks(ts => ts.map(x => x.id === t.id ? { ...x, status: done ? 'done' : 'open' } : x))
    const { error } = await supabase.from('crm_tasks').update({
      status: done ? 'done' : 'open', completed_at: done ? new Date().toISOString() : null,
    }).eq('id', t.id)
    if (error) toast.error(error.message)
  }

  async function remove(t) {
    setTasks(ts => ts.filter(x => x.id !== t.id))
    const { error } = await supabase.from('crm_tasks').delete().eq('id', t.id)
    if (error) { toast.error(error.message); fetchAll() }
  }

  const filtered = useMemo(() => {
    if (filter === 'all') return tasks
    return tasks.filter(t => filter === 'done' ? t.status === 'done' : t.status !== 'done')
  }, [tasks, filter])

  const openCount = tasks.filter(t => t.status !== 'done').length
  const overdue   = tasks.filter(t => t.status !== 'done' && t.due_date && t.due_date < todayStr()).length

  if (needSetup) {
    return (
      <div className="space-y-5">
        <h1 className="page-header">Follow-up Tasks</h1>
        <div className="card p-10 text-center">
          <AlertTriangle size={36} className="mx-auto text-amber-400 mb-3" />
          <p className="font-semibold text-gray-700">CRM database setup required</p>
          <p className="text-sm text-gray-500 mt-1">Run <span className="font-mono">supabase/migrations/20260610_crm.sql</span> in the Supabase SQL Editor (see <span className="font-mono">CRM_SETUP.md</span>), then refresh.</p>
          <button onClick={fetchAll} className="mt-4 px-4 py-2 bg-brand-500 text-white rounded-xl text-sm font-semibold hover:bg-brand-600 cursor-pointer">Retry</button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-header">Follow-up Tasks</h1>
          <p className="text-sm text-gray-500 mt-0.5">{openCount} open{overdue > 0 && <span className="text-red-500 font-semibold"> · {overdue} overdue</span>}</p>
        </div>
        <button onClick={fetchAll} className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl cursor-pointer"><RefreshCw size={16} /></button>
      </div>

      {/* Add task */}
      <div className="card p-4">
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto_auto] gap-2">
          <input value={form.title} onChange={e => setF('title', e.target.value)} onKeyDown={e => e.key === 'Enter' && addTask()}
            placeholder="New follow-up… (e.g. Call Skyline about quote)"
            className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent" />
          <select value={form.customer_id} onChange={e => setF('customer_id', e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-xl text-sm cursor-pointer focus:outline-none focus:ring-1 focus:ring-brand-400">
            <option value="">No customer</option>
            {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={form.priority} onChange={e => setF('priority', e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-xl text-sm cursor-pointer focus:outline-none focus:ring-1 focus:ring-brand-400">
            {Object.entries(TASK_PRIORITY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <div className="flex gap-2">
            <input type="date" value={form.due_date} onChange={e => setF('due_date', e.target.value)}
              className="px-2 py-2 border border-gray-200 rounded-xl text-sm" />
            <button onClick={addTask} className="px-4 py-2 bg-brand-500 text-white rounded-xl text-sm font-semibold hover:bg-brand-600 cursor-pointer flex items-center gap-1"><Plus size={15} /></button>
          </div>
        </div>
      </div>

      {/* Filter pills */}
      <div className="flex gap-1.5">
        {[['open', 'Open'], ['done', 'Done'], ['all', 'All']].map(([k, label]) => (
          <button key={k} onClick={() => setFilter(k)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer ${filter === k ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="text-center py-16 text-gray-400 text-sm">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="card p-16 text-center">
          <CheckSquare size={40} className="mx-auto text-gray-200 mb-3" />
          <p className="text-gray-400 font-medium">No {filter === 'all' ? '' : filter} tasks</p>
        </div>
      ) : (
        <div className="card divide-y divide-gray-50">
          {filtered.map(t => {
            const isOverdue = t.status !== 'done' && t.due_date && t.due_date < todayStr()
            return (
              <div key={t.id} className="flex items-center gap-3 px-4 py-3 group">
                <button onClick={() => toggle(t)} className="cursor-pointer text-gray-400 hover:text-brand-500 flex-shrink-0">
                  {t.status === 'done' ? <CheckSquare size={18} className="text-emerald-500" /> : <Square size={18} />}
                </button>
                <div className="flex-1 min-w-0">
                  <span className={`text-sm ${t.status === 'done' ? 'line-through text-gray-300' : 'text-gray-800'}`}>{t.title}</span>
                  {t.customers?.name && (
                    <button onClick={() => navigate(`/crm/customers/${t.customers.id}`)}
                      className="ml-2 text-[11px] text-brand-600 hover:underline cursor-pointer">{t.customers.name}</button>
                  )}
                </div>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-lg border ${TASK_PRIORITY[t.priority]?.badge || TASK_PRIORITY.normal.badge}`}>
                  {TASK_PRIORITY[t.priority]?.label || 'Normal'}
                </span>
                {t.due_date && (
                  <span className={`text-[11px] flex items-center gap-1 ${isOverdue ? 'text-red-500 font-semibold' : 'text-gray-400'}`}>
                    <CalendarClock size={12} />{fmtDate(t.due_date)}
                  </span>
                )}
                <button onClick={() => remove(t)} className="text-gray-300 hover:text-red-500 cursor-pointer opacity-0 group-hover:opacity-100 flex-shrink-0"><Trash2 size={14} /></button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

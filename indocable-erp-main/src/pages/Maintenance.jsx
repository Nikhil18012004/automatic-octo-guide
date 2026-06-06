import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../supabase'
import toast from 'react-hot-toast'
import { confirmToast } from '../components/confirmToast'
import {
  Wrench, Plus, RefreshCw, X, Save, AlertTriangle,
  CheckCircle2, Clock, Trash2, Calendar, Factory
} from 'lucide-react'
import { fmtDate } from '../lib/format'

function fmtDateTime(d){return d?new Date(d).toLocaleString('en-IN',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):'—'}
function todayISO(){return new Date().toISOString().slice(0,10)}

const BD_STATUS = {
  open:     { label:'Open',     color:'bg-red-100 text-red-700 border-red-200' },
  resolved: { label:'Resolved', color:'bg-emerald-100 text-emerald-700 border-emerald-200' },
}

const EMPTY_BD = { machine_id:'', description:'', start_time: new Date().toISOString().slice(0,16), end_time:'', reported_by:'' }
const EMPTY_PM = { machine_id:'', maintenance_type:'', due_date:'', notes:'' }

export default function Maintenance({ profile }) {
  const [tab, setTab] = useState('breakdowns')
  const [machines,     setMachines]     = useState([])
  const [employees,    setEmployees]    = useState([])
  const [breakdowns,   setBreakdowns]   = useState([])
  const [schedule,     setSchedule]     = useState([])
  const [loading,      setLoading]      = useState(true)

  const [showBdModal,  setShowBdModal]  = useState(false)
  const [bdForm,       setBdForm]       = useState({ ...EMPTY_BD })
  const [bdSaving,     setBdSaving]     = useState(false)
  const [resolveModal, setResolveModal] = useState(null) // breakdown id
  const [resolveNotes, setResolveNotes] = useState('')
  const [resolveEnd,   setResolveEnd]   = useState(new Date().toISOString().slice(0,16))

  const [showPmModal,  setShowPmModal]  = useState(false)
  const [pmForm,       setPmForm]       = useState({ ...EMPTY_PM })
  const [pmSaving,     setPmSaving]     = useState(false)

  const canManage = ['owner','admin','production_head'].includes(profile.role)
  const machMap   = useMemo(()=>Object.fromEntries(machines.map(m=>[m.id,m])),[machines])

  useEffect(()=>{ fetchAll() },[])

  async function fetchAll() {
    setLoading(true)
    const [{ data: machData },{ data: empData },{ data: bdData },{ data: pmData }] = await Promise.all([
      supabase.from('machines').select('id,process_name,department').order('department').order('process_name'),
      supabase.from('employees').select('id,full_name,position').eq('is_active',true).order('full_name'),
      supabase.from('machine_breakdowns').select('*').order('created_at',{ascending:false}),
      supabase.from('maintenance_schedule').select('*').order('due_date'),
    ])
    setMachines(machData||[])
    setEmployees(empData||[])
    setBreakdowns(bdData||[])
    setSchedule(pmData||[])
    setLoading(false)
  }

  // ── Breakdown CRUD ────────────────────────────────────────────────────────
  async function saveBreakdown() {
    if (!bdForm.machine_id) { toast.error('Select a machine'); return }
    if (!bdForm.description.trim()) { toast.error('Describe the breakdown'); return }
    setBdSaving(true)
    const { error } = await supabase.from('machine_breakdowns').insert({
      machine_id:   bdForm.machine_id,
      description:  bdForm.description.trim(),
      start_time:   bdForm.start_time || new Date().toISOString(),
      end_time:     null,
      downtime_hours: null,
      reported_by:  bdForm.reported_by || null,
      status:       'open',
    })
    setBdSaving(false)
    if (error) { toast.error(error.message); return }
    toast.success('Breakdown logged')
    setShowBdModal(false)
    setBdForm({ ...EMPTY_BD })
    fetchAll()
  }

  async function resolveBreakdown() {
    const bd = breakdowns.find(b=>b.id===resolveModal)
    if (!bd) return
    const start = new Date(bd.start_time)
    const end   = new Date(resolveEnd)
    const downtime = Math.max(0, (end - start) / 3600000)
    const { error } = await supabase.from('machine_breakdowns').update({
      status:           'resolved',
      end_time:         resolveEnd,
      downtime_hours:   Math.round(downtime * 10) / 10,
      resolution_notes: resolveNotes || null,
    }).eq('id', resolveModal)
    if (error) { toast.error(error.message); return }
    toast.success(`Resolved — ${Math.round(downtime * 10) / 10}h downtime`)
    setResolveModal(null); setResolveNotes(''); fetchAll()
  }

  async function deleteBreakdown(id) {
    if (!await confirmToast('Delete this breakdown record?')) return
    const { error } = await supabase.from('machine_breakdowns').delete().eq('id', id)
    if (error) { toast.error(error.message); return }
    setBreakdowns(b=>b.filter(bd=>bd.id!==id))
    toast.success('Deleted')
  }

  // ── PM schedule CRUD ──────────────────────────────────────────────────────
  async function savePM() {
    if (!pmForm.machine_id) { toast.error('Select a machine'); return }
    if (!pmForm.maintenance_type.trim()) { toast.error('Enter maintenance type'); return }
    if (!pmForm.due_date) { toast.error('Set due date'); return }
    setPmSaving(true)
    const { error } = await supabase.from('maintenance_schedule').insert({
      machine_id:       pmForm.machine_id,
      maintenance_type: pmForm.maintenance_type.trim(),
      due_date:         pmForm.due_date,
      notes:            pmForm.notes||null,
      is_completed:     false,
    })
    setPmSaving(false)
    if (error) { toast.error(error.message); return }
    toast.success('Scheduled')
    setShowPmModal(false); setPmForm({ ...EMPTY_PM }); fetchAll()
  }

  async function markPMDone(id) {
    const { error } = await supabase.from('maintenance_schedule').update({ is_completed: true, last_done_date: todayISO() }).eq('id', id)
    if (error) { toast.error(error.message); return }
    setSchedule(s=>s.map(pm=>pm.id===id?{...pm,is_completed:true,last_done_date:todayISO()}:pm))
    toast.success('Marked as done')
  }

  async function deletePM(id) {
    if (!await confirmToast('Delete this schedule item?')) return
    const { error } = await supabase.from('maintenance_schedule').delete().eq('id', id)
    if (error) { toast.error(error.message); return }
    setSchedule(s=>s.filter(pm=>pm.id!==id))
    toast.success('Deleted')
  }

  // ── Derived stats ─────────────────────────────────────────────────────────
  const openBreakdowns = breakdowns.filter(b=>b.status==='open')
  const overduePM      = schedule.filter(pm=>!pm.is_completed && pm.due_date < todayISO())

  // Downtime by machine (last 30 days)
  const downtimeByMachine = useMemo(()=>{
    const since = new Date(Date.now()-30*86400000).toISOString()
    const m = {}
    breakdowns.filter(b=>b.status==='resolved' && b.start_time >= since).forEach(b=>{
      if (!m[b.machine_id]) m[b.machine_id] = { incidents:0, hours:0 }
      m[b.machine_id].incidents++
      m[b.machine_id].hours += parseFloat(b.downtime_hours)||0
    })
    return Object.entries(m).sort((a,b)=>b[1].hours-a[1].hours)
  },[breakdowns])

  const maxDowntime = Math.max(...downtimeByMachine.map(([,d])=>d.hours),1)

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center">
            <Wrench size={20} className="text-amber-600"/>
          </div>
          <div>
            <h1 className="page-header">Maintenance</h1>
            <p className="page-sub">Machine breakdowns & preventive maintenance</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchAll} className="p-2 rounded-xl border border-slate-200 bg-white text-slate-400 hover:text-slate-600 cursor-pointer">
            <RefreshCw size={15} className={loading?'animate-spin':''}/>
          </button>
          {canManage && tab==='breakdowns' && (
            <button onClick={()=>{setBdForm({...EMPTY_BD,start_time:new Date().toISOString().slice(0,16)});setShowBdModal(true)}}
              className="flex items-center gap-1.5 text-[13px] font-semibold bg-red-500 text-white px-4 py-2 rounded-xl hover:bg-red-600 cursor-pointer">
              <AlertTriangle size={14}/> Log Breakdown
            </button>
          )}
          {canManage && tab==='schedule' && (
            <button onClick={()=>{setPmForm({...EMPTY_PM});setShowPmModal(true)}}
              className="flex items-center gap-1.5 text-[13px] font-semibold bg-brand-500 text-white px-4 py-2 rounded-xl hover:bg-brand-600 cursor-pointer">
              <Plus size={14}/> Schedule PM
            </button>
          )}
        </div>
      </div>

      {/* Alert strip */}
      {(openBreakdowns.length > 0 || overduePM.length > 0) && (
        <div className="flex flex-wrap gap-3 mb-5">
          {openBreakdowns.length > 0 && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">
              <AlertTriangle size={14} className="text-red-500 flex-shrink-0"/>
              <span className="text-red-700 text-sm font-semibold">{openBreakdowns.length} open breakdown{openBreakdowns.length!==1?'s':''}</span>
            </div>
          )}
          {overduePM.length > 0 && (
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5">
              <Clock size={14} className="text-amber-600 flex-shrink-0"/>
              <span className="text-amber-700 text-sm font-semibold">{overduePM.length} overdue PM task{overduePM.length!==1?'s':''}</span>
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-slate-100 rounded-2xl w-fit mb-5">
        {[
          {key:'breakdowns', icon:AlertTriangle, label:'Breakdowns'},
          {key:'schedule',   icon:Calendar,      label:'PM Schedule'},
          {key:'report',     icon:Factory,       label:'Downtime Report'},
        ].map(t=>(
          <button key={t.key} onClick={()=>setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer
              ${tab===t.key?'bg-white shadow-sm text-slate-900':'text-slate-500 hover:text-slate-700'}`}>
            <t.icon size={13}/>{t.label}
            {t.key==='breakdowns' && openBreakdowns.length>0 && (
              <span className="w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">{openBreakdowns.length}</span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="card p-5 flex gap-4">
              <div className="skeleton h-10 w-24 flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="skeleton h-4 w-48" />
                <div className="skeleton h-3 w-64" />
                <div className="skeleton h-3 w-40" />
              </div>
              <div className="skeleton h-8 w-20 flex-shrink-0" />
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* ── BREAKDOWNS ────────────────────────────────────────────────────── */}
          {tab==='breakdowns' && (
            <div className="space-y-3">
              {breakdowns.length===0 ? (
                <div className="card p-12 text-center">
                  <CheckCircle2 size={40} className="mx-auto text-emerald-300 mb-3"/>
                  <div className="text-slate-600 font-semibold">No breakdowns logged</div>
                  <div className="text-slate-400 text-sm mt-1">All machines are running smoothly.</div>
                </div>
              ) : breakdowns.map(bd=>{
                const mach = machMap[bd.machine_id]
                const isOpen = bd.status==='open'
                return (
                  <div key={bd.id} className={`card p-5 ${isOpen?'border-red-200':''}`}>
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border ${BD_STATUS[bd.status]?.color}`}>
                            {BD_STATUS[bd.status]?.label}
                          </span>
                          <span className="font-semibold text-slate-800">{mach?.process_name||'Unknown Machine'}</span>
                          {mach?.department && <span className="text-[12px] text-slate-400">{mach.department}</span>}
                        </div>
                        <p className="text-sm text-slate-700 mt-1">{bd.description}</p>
                        <div className="flex flex-wrap gap-3 mt-2 text-[12px] text-slate-500">
                          <span className="flex items-center gap-1"><Clock size={11}/> Started: {fmtDateTime(bd.start_time)}</span>
                          {bd.end_time && <span>Resolved: {fmtDateTime(bd.end_time)}</span>}
                          {bd.downtime_hours != null && <span className="font-semibold text-red-600">Downtime: {bd.downtime_hours}h</span>}
                          {bd.reported_by && <span>By: {bd.reported_by}</span>}
                        </div>
                        {bd.resolution_notes && (
                          <div className="mt-2 text-[12px] text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-1.5">
                            Resolution: {bd.resolution_notes}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {canManage && isOpen && (
                          <button onClick={()=>{setResolveModal(bd.id);setResolveNotes('');setResolveEnd(new Date().toISOString().slice(0,16))}}
                            className="flex items-center gap-1 text-[12px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded-xl hover:bg-emerald-100 cursor-pointer">
                            <CheckCircle2 size={12}/> Resolve
                          </button>
                        )}
                        {canManage && (
                          <button onClick={()=>deleteBreakdown(bd.id)} className="p-1.5 text-slate-300 hover:text-red-500 cursor-pointer transition-colors"><Trash2 size={13}/></button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* ── PM SCHEDULE ──────────────────────────────────────────────────── */}
          {tab==='schedule' && (
            <div className="space-y-3">
              {schedule.length===0 ? (
                <div className="card p-12 text-center">
                  <Calendar size={40} className="mx-auto text-slate-300 mb-3"/>
                  <div className="text-slate-600 font-semibold">No maintenance scheduled</div>
                  <div className="text-slate-400 text-sm mt-1">Click "Schedule PM" to add preventive maintenance tasks.</div>
                </div>
              ) : schedule.map(pm=>{
                const mach    = machMap[pm.machine_id]
                const overdue = !pm.is_completed && pm.due_date < todayISO()
                const today   = pm.due_date === todayISO()
                return (
                  <div key={pm.id} className={`card p-5 ${pm.is_completed?'opacity-60':overdue?'border-amber-300':''}`}>
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${pm.is_completed?'bg-emerald-50':overdue?'bg-amber-50':'bg-slate-50'}`}>
                          {pm.is_completed ? <CheckCircle2 size={16} className="text-emerald-500"/> : overdue ? <AlertTriangle size={16} className="text-amber-500"/> : <Calendar size={16} className="text-slate-400"/>}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-800">{pm.maintenance_type}</div>
                          <div className="text-[12px] text-slate-500 mt-0.5">{mach?.process_name||'—'} {mach?.department?`· ${mach.department}`:''}</div>
                          <div className={`text-[12px] font-semibold mt-1 ${pm.is_completed?'text-emerald-600':overdue?'text-amber-700':today?'text-blue-600':'text-slate-500'}`}>
                            {pm.is_completed ? `Done on ${fmtDate(pm.last_done_date)}` : overdue ? `Overdue since ${fmtDate(pm.due_date)}` : today ? `Due today` : `Due ${fmtDate(pm.due_date)}`}
                          </div>
                          {pm.notes && <div className="text-[11px] text-slate-400 mt-1">{pm.notes}</div>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {canManage && !pm.is_completed && (
                          <button onClick={()=>markPMDone(pm.id)}
                            className="flex items-center gap-1 text-[12px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded-xl hover:bg-emerald-100 cursor-pointer">
                            <CheckCircle2 size={12}/> Mark Done
                          </button>
                        )}
                        {canManage && (
                          <button onClick={()=>deletePM(pm.id)} className="p-1.5 text-slate-300 hover:text-red-500 cursor-pointer transition-colors"><Trash2 size={13}/></button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* ── DOWNTIME REPORT ───────────────────────────────────────────────── */}
          {tab==='report' && (
            <div className="space-y-5">
              <div className="text-[12px] text-slate-400 mb-1">Last 30 days — resolved breakdowns only</div>
              {downtimeByMachine.length===0 ? (
                <div className="card p-12 text-center">
                  <CheckCircle2 size={40} className="mx-auto text-emerald-300 mb-3"/>
                  <div className="text-slate-600 font-semibold">No downtime in last 30 days</div>
                </div>
              ) : (
                <div className="card overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-100">
                    <div className="text-sm font-bold text-slate-700">Downtime by Machine</div>
                  </div>
                  <div className="p-5 space-y-4">
                    {downtimeByMachine.map(([machId, data])=>{
                      const mach = machMap[machId]
                      const pct  = (data.hours / maxDowntime) * 100
                      return (
                        <div key={machId}>
                          <div className="flex justify-between items-center mb-1.5">
                            <div>
                              <span className="text-[13px] font-semibold text-slate-800">{mach?.process_name||'Unknown'}</span>
                              {mach?.department && <span className="text-[11px] text-slate-400 ml-2">{mach.department}</span>}
                            </div>
                            <div className="text-right">
                              <span className="text-[13px] font-bold text-red-600">{data.hours.toFixed(1)}h</span>
                              <span className="text-[11px] text-slate-400 ml-2">{data.incidents} incident{data.incidents!==1?'s':''}</span>
                            </div>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                            <div className="bg-red-400 h-2 rounded-full transition-all" style={{width:`${pct}%`}}/>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex justify-between text-sm">
                    <span className="text-slate-500">Total downtime (30 days)</span>
                    <span className="font-bold text-red-600">{downtimeByMachine.reduce((s,[,d])=>s+d.hours,0).toFixed(1)}h</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ── LOG BREAKDOWN MODAL ───────────────────────────────────────────────── */}
      {showBdModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <span className="font-bold text-red-700 flex items-center gap-2"><AlertTriangle size={16}/> Log Machine Breakdown</span>
              <button onClick={()=>setShowBdModal(false)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"><X size={16}/></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Machine *</label>
                <select value={bdForm.machine_id} onChange={e=>setBdForm(f=>({...f,machine_id:e.target.value}))}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-red-400">
                  <option value="">Select machine…</option>
                  {machines.map(m=><option key={m.id} value={m.id}>{m.process_name}{m.department?` (${m.department})`:''}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Description *</label>
                <textarea value={bdForm.description} onChange={e=>setBdForm(f=>({...f,description:e.target.value}))}
                  placeholder="Describe the breakdown / fault…" rows={3}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-red-400 resize-none"/>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Start Time</label>
                  <input type="datetime-local" value={bdForm.start_time} onChange={e=>setBdForm(f=>({...f,start_time:e.target.value}))}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-red-400"/>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Reported By</label>
                  <input value={bdForm.reported_by} onChange={e=>setBdForm(f=>({...f,reported_by:e.target.value}))}
                    placeholder="Name or emp code"
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-red-400"/>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-slate-100">
              <button onClick={()=>setShowBdModal(false)} className="px-4 py-2 text-sm font-semibold text-slate-500 hover:text-slate-700 cursor-pointer">Cancel</button>
              <button onClick={saveBreakdown} disabled={bdSaving}
                className="flex items-center gap-1.5 bg-red-500 text-white px-5 py-2 rounded-xl text-sm font-semibold hover:bg-red-600 disabled:opacity-60 cursor-pointer">
                {bdSaving?<RefreshCw size={13} className="animate-spin"/>:<Save size={13}/>} Log Breakdown
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── RESOLVE MODAL ─────────────────────────────────────────────────────── */}
      {resolveModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <span className="font-bold text-emerald-700 flex items-center gap-2"><CheckCircle2 size={16}/> Resolve Breakdown</span>
              <button onClick={()=>setResolveModal(null)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"><X size={16}/></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">End Time</label>
                <input type="datetime-local" value={resolveEnd} onChange={e=>setResolveEnd(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"/>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Resolution Notes</label>
                <textarea value={resolveNotes} onChange={e=>setResolveNotes(e.target.value)}
                  placeholder="What was the cause? What was fixed?" rows={3}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-none"/>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-slate-100">
              <button onClick={()=>setResolveModal(null)} className="px-4 py-2 text-sm font-semibold text-slate-500 hover:text-slate-700 cursor-pointer">Cancel</button>
              <button onClick={resolveBreakdown}
                className="flex items-center gap-1.5 bg-emerald-500 text-white px-5 py-2 rounded-xl text-sm font-semibold hover:bg-emerald-600 cursor-pointer">
                <CheckCircle2 size={13}/> Mark Resolved
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── SCHEDULE PM MODAL ─────────────────────────────────────────────────── */}
      {showPmModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <span className="font-bold text-slate-800">Schedule Preventive Maintenance</span>
              <button onClick={()=>setShowPmModal(false)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"><X size={16}/></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Machine *</label>
                <select value={pmForm.machine_id} onChange={e=>setPmForm(f=>({...f,machine_id:e.target.value}))}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500">
                  <option value="">Select machine…</option>
                  {machines.map(m=><option key={m.id} value={m.id}>{m.process_name}{m.department?` (${m.department})`:''}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Maintenance Type *</label>
                <input value={pmForm.maintenance_type} onChange={e=>setPmForm(f=>({...f,maintenance_type:e.target.value}))}
                  placeholder="e.g. Oil change, Belt inspection, Lubrication"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500"/>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Due Date *</label>
                <input type="date" value={pmForm.due_date} onChange={e=>setPmForm(f=>({...f,due_date:e.target.value}))}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500"/>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Notes</label>
                <input value={pmForm.notes} onChange={e=>setPmForm(f=>({...f,notes:e.target.value}))}
                  placeholder="Any specific instructions…"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500"/>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-slate-100">
              <button onClick={()=>setShowPmModal(false)} className="px-4 py-2 text-sm font-semibold text-slate-500 hover:text-slate-700 cursor-pointer">Cancel</button>
              <button onClick={savePM} disabled={pmSaving}
                className="flex items-center gap-1.5 bg-brand-500 text-white px-5 py-2 rounded-xl text-sm font-semibold hover:bg-brand-600 disabled:opacity-60 cursor-pointer">
                {pmSaving?<RefreshCw size={13} className="animate-spin"/>:<Save size={13}/>} Schedule
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

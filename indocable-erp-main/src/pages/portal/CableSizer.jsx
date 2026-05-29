import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Calculator, MessageSquare, CheckCircle2, AlertTriangle, ArrowRight, Info, Zap } from 'lucide-react'

// Copper resistivity: 0.0168 Ω·mm²/m at 20°C, Al: 0.028 Ω·mm²/m
const RESISTIVITY = { copper: 0.0168, aluminium: 0.028 }

// Current ratings (A) for various sizes — copper, PVC 70°C insulated
// Format: { size_sqmm, inAir, inConduit, underground }
const RATINGS_COPPER = [
  { size: 1.5,  inAir: 17,  inConduit: 14,  underground: 16  },
  { size: 2.5,  inAir: 23,  inConduit: 19,  underground: 21  },
  { size: 4,    inAir: 31,  inConduit: 25,  underground: 28  },
  { size: 6,    inAir: 41,  inConduit: 33,  underground: 37  },
  { size: 10,   inAir: 57,  inConduit: 46,  underground: 50  },
  { size: 16,   inAir: 76,  inConduit: 61,  underground: 67  },
  { size: 25,   inAir: 100, inConduit: 79,  underground: 88  },
  { size: 35,   inAir: 122, inConduit: 96,  underground: 107 },
  { size: 50,   inAir: 148, inConduit: 115, underground: 129 },
  { size: 70,   inAir: 189, inConduit: 148, underground: 163 },
  { size: 95,   inAir: 229, inConduit: 179, underground: 198 },
  { size: 120,  inAir: 264, inConduit: 207, underground: 228 },
  { size: 150,  inAir: 300, inConduit: 235, underground: 261 },
  { size: 185,  inAir: 341, inConduit: 267, underground: 298 },
  { size: 240,  inAir: 400, inConduit: 313, underground: 352 },
  { size: 300,  inAir: 458, inConduit: 358, underground: 403 },
]

// Aluminium ratings ≈ copper × 0.78
const RATINGS_ALUMINIUM = RATINGS_COPPER.map(r => ({
  ...r,
  inAir:       Math.round(r.inAir * 0.78),
  inConduit:   Math.round(r.inConduit * 0.78),
  underground: Math.round(r.underground * 0.78),
}))

const INSTALLATION_KEYS = {
  air:        'inAir',
  conduit:    'inConduit',
  underground:'underground',
  tray:       'inAir',
}

function calcResult(form) {
  const { phase, loadKw, loadA, voltage, pf, distance, conductor, installation } = form

  const V   = parseFloat(voltage) || 0
  const PF  = parseFloat(pf)      || 0.85
  const D   = parseFloat(distance)|| 0
  const ρ   = RESISTIVITY[conductor]

  let I = 0
  if (loadA && parseFloat(loadA) > 0) {
    I = parseFloat(loadA)
  } else if (loadKw && parseFloat(loadKw) > 0) {
    const kW = parseFloat(loadKw)
    I = phase === '3ph'
      ? (kW * 1000) / (Math.sqrt(3) * V * PF)
      : (kW * 1000) / (V * PF)
  }
  if (!I || I <= 0) return null

  const ratings = conductor === 'copper' ? RATINGS_COPPER : RATINGS_ALUMINIUM
  const key     = INSTALLATION_KEYS[installation] || 'inAir'

  // Find smallest cable that carries I
  const sizedByCurrents = ratings.filter(r => r[key] >= I)
  if (sizedByCurrents.length === 0) return { tooLarge: true, current: Math.round(I * 10) / 10 }

  // Check voltage drop for each candidate until we find one within 5%
  let selected = null
  for (const candidate of sizedByCurrents) {
    const A  = candidate.size
    const VD = phase === '3ph'
      ? (Math.sqrt(3) * ρ * D * I) / A
      : (2 * ρ * D * I) / A
    const VDpct = (VD / V) * 100
    if (VDpct <= 5) {
      selected = { ...candidate, VD: Math.round(VD * 10) / 10, VDpct: Math.round(VDpct * 100) / 100, current: Math.round(I * 10) / 10, key }
      break
    }
  }

  if (!selected) {
    // Just return the largest and flag VD issue
    const last = sizedByCurrents[sizedByCurrents.length - 1]
    const A    = last.size
    const VD   = phase === '3ph'
      ? (Math.sqrt(3) * ρ * D * I) / A
      : (2 * ρ * D * I) / A
    selected = { ...last, VD: Math.round(VD * 10) / 10, VDpct: Math.round((VD / V) * 10000) / 100, current: Math.round(I * 10) / 10, key, vdExceeded: true }
  }

  return selected
}

export default function CableSizer() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    phase:        '1ph',
    loadKw:       '',
    loadA:        '',
    voltage:      '230',
    pf:           '0.85',
    distance:     '',
    conductor:    'copper',
    installation: 'conduit',
  })
  const [result, setResult] = useState(null)
  const [calculated, setCalculated] = useState(false)

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); setCalculated(false) }

  function calculate(e) {
    e.preventDefault()
    const r = calcResult(form)
    setResult(r)
    setCalculated(true)
  }

  const waText = result && !result.tooLarge
    ? encodeURIComponent(`Hi, I need cables for:\nLoad: ${form.loadKw || form.loadA} ${form.loadKw ? 'kW' : 'A'}, ${form.voltage}V, ${form.phase === '3ph' ? '3-phase' : '1-phase'}\nDistance: ${form.distance}m\nRecommended: ${result.size} sq mm ${form.conductor} cable\nPlease share price and availability.`)
    : ''

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-7 py-10">

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-2xl bg-brand-50 flex items-center justify-center">
            <Calculator size={20} className="text-brand-500" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">Cable Sizer</h1>
            <p className="text-gray-500 text-sm">Calculate the right cable size for your application</p>
          </div>
        </div>
        <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 mt-4 text-sm text-blue-700">
          <Info size={14} className="flex-shrink-0 mt-0.5" />
          <span>Calculations per IS 732. Results are for guidance — consult a licensed electrician for final installation design.</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

        {/* ── Input Form ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-6">
          <h2 className="font-bold text-gray-900 mb-5 text-sm uppercase tracking-wide">Load Details</h2>
          <form onSubmit={calculate} className="space-y-4">

            {/* Phase */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-2">Power Supply</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: '1ph', label: 'Single Phase', sub: '230V / 240V' },
                  { value: '3ph', label: 'Three Phase',  sub: '415V / 440V' },
                ].map(o => (
                  <label key={o.value}
                    className={`flex flex-col p-3 rounded-xl border cursor-pointer transition-all ${form.phase === o.value ? 'border-brand-400 bg-brand-50' : 'border-gray-200 hover:border-gray-300'}`}>
                    <input type="radio" className="sr-only" checked={form.phase === o.value} onChange={() => {
                      set('phase', o.value)
                      set('voltage', o.value === '1ph' ? '230' : '415')
                    }} />
                    <span className="text-sm font-bold text-gray-900">{o.label}</span>
                    <span className="text-[11px] text-gray-400">{o.sub}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Load */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-2">Load (enter one)</label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="relative">
                    <input type="number" min="0" step="0.1" value={form.loadKw}
                      onChange={e => { set('loadKw', e.target.value); set('loadA', '') }}
                      placeholder="kW"
                      className="w-full pl-3 pr-12 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500" />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-semibold">kW</span>
                  </div>
                </div>
                <div>
                  <div className="relative">
                    <input type="number" min="0" step="0.1" value={form.loadA}
                      onChange={e => { set('loadA', e.target.value); set('loadKw', '') }}
                      placeholder="Amps"
                      className="w-full pl-3 pr-12 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500" />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-semibold">A</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Voltage & PF */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-2">Voltage (V)</label>
                <input type="number" value={form.voltage} onChange={e => set('voltage', e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-2">Power Factor</label>
                <input type="number" min="0.5" max="1" step="0.01" value={form.pf}
                  onChange={e => set('pf', e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500" />
              </div>
            </div>

            {/* Distance */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-2">Cable Run Distance (meters)</label>
              <input required type="number" min="1" step="1" value={form.distance}
                onChange={e => set('distance', e.target.value)}
                placeholder="e.g. 50"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500" />
            </div>

            {/* Conductor */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-2">Conductor Material</label>
              <div className="grid grid-cols-2 gap-2">
                {[{ value: 'copper', label: 'Copper (EC Grade)' }, { value: 'aluminium', label: 'Aluminium (EC Grade)' }].map(o => (
                  <label key={o.value}
                    className={`flex items-center gap-2 p-3 rounded-xl border cursor-pointer transition-all text-sm font-medium ${form.conductor === o.value ? 'border-brand-400 bg-brand-50 text-brand-700' : 'border-gray-200 text-gray-700 hover:border-gray-300'}`}>
                    <input type="radio" className="sr-only" checked={form.conductor === o.value} onChange={() => set('conductor', o.value)} />
                    {o.label}
                  </label>
                ))}
              </div>
            </div>

            {/* Installation */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-2">Installation Method</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: 'conduit',    label: 'In Conduit' },
                  { value: 'air',        label: 'Open in Air' },
                  { value: 'underground','label': 'Underground' },
                  { value: 'tray',       label: 'Cable Tray' },
                ].map(o => (
                  <label key={o.value}
                    className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer transition-all text-sm ${form.installation === o.value ? 'border-brand-400 bg-brand-50 text-brand-700 font-semibold' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                    <input type="radio" className="sr-only" checked={form.installation === o.value} onChange={() => set('installation', o.value)} />
                    {o.label}
                  </label>
                ))}
              </div>
            </div>

            <button type="submit"
              className="w-full py-3.5 bg-brand-500 hover:bg-brand-600 text-white rounded-2xl font-bold text-sm transition-colors shadow-glow-orange flex items-center justify-center gap-2">
              <Zap size={16} /> Calculate Cable Size
            </button>
          </form>
        </div>

        {/* ── Results ── */}
        <div className="space-y-4">
          {!calculated ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-8 text-center h-64 flex flex-col items-center justify-center">
              <Calculator size={40} className="text-gray-200 mb-3" />
              <p className="text-gray-400 font-medium">Fill in the load details and click Calculate</p>
              <p className="text-gray-300 text-sm mt-1">We'll recommend the right cable size for you</p>
            </div>
          ) : result?.tooLarge ? (
            <div className="bg-white rounded-2xl border border-red-100 shadow-card p-6 text-center">
              <AlertTriangle size={36} className="text-red-400 mx-auto mb-3" />
              <h3 className="font-black text-gray-900 mb-1">Load Exceeds Standard Sizes</h3>
              <p className="text-gray-500 text-sm mb-4">Calculated current: <strong>{result.current} A</strong> — requires a bus bar or special cable arrangement.</p>
              <p className="text-gray-400 text-sm">Please contact us for custom cable specification.</p>
            </div>
          ) : result ? (
            <>
              {/* Main recommendation */}
              <div className={`bg-white rounded-2xl border shadow-card p-6 ${result.vdExceeded ? 'border-amber-200' : 'border-emerald-200'}`}>
                <div className="flex items-center gap-2 mb-4">
                  {result.vdExceeded
                    ? <><AlertTriangle size={16} className="text-amber-500" /><span className="text-sm font-bold text-amber-700">Recommended with caution</span></>
                    : <><CheckCircle2 size={16} className="text-emerald-500" /><span className="text-sm font-bold text-emerald-700">Recommended Cable</span></>
                  }
                </div>

                <div className="text-5xl font-black text-gray-900 mb-1">
                  {result.size} <span className="text-2xl text-gray-500">sq mm</span>
                </div>
                <div className="text-base text-gray-600 font-semibold mb-5 capitalize">
                  {form.conductor} · {form.phase === '3ph' ? '3-Phase' : 'Single Phase'} · {form.installation === 'air' ? 'Open Air' : form.installation === 'conduit' ? 'In Conduit' : form.installation === 'underground' ? 'Underground' : 'Cable Tray'}
                </div>

                <div className="grid grid-cols-3 gap-3 mb-5">
                  {[
                    { label: 'Current Draw', value: `${result.current} A`, sub: `Rated: ${result[result.key]} A` },
                    { label: 'Voltage Drop', value: `${result.VDpct}%`, sub: `${result.VD} V` },
                    { label: 'VD Limit', value: result.vdExceeded ? '> 5%' : '≤ 5%', ok: !result.vdExceeded },
                  ].map(s => (
                    <div key={s.label} className="bg-gray-50 rounded-xl p-3 text-center">
                      <div className={`text-base font-black ${s.ok === false ? 'text-red-600' : s.ok === true ? 'text-emerald-600' : 'text-gray-900'}`}>{s.value}</div>
                      <div className="text-[11px] text-gray-500 mt-0.5">{s.label}</div>
                      {s.sub && <div className="text-[10px] text-gray-400">{s.sub}</div>}
                    </div>
                  ))}
                </div>

                {result.vdExceeded && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-700 mb-4">
                    Voltage drop exceeds 5% limit (IS 732). Consider using a larger size or reducing cable run length.
                  </div>
                )}

                <div className="space-y-2">
                  <button
                    onClick={() => navigate(`/portal/catalog?category=${form.conductor === 'copper' ? 'flexible-cables' : 'xlpe-cables'}`)}
                    className="w-full py-3 bg-brand-500 hover:bg-brand-600 text-white rounded-2xl font-bold text-sm transition-colors shadow-glow-orange flex items-center justify-center gap-2"
                  >
                    Browse {result.size} sq mm Cables <ArrowRight size={15} />
                  </button>
                  <a
                    href={`https://wa.me/918073533289?text=${waText}`}
                    target="_blank" rel="noopener noreferrer"
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold text-sm transition-colors flex items-center justify-center gap-2"
                  >
                    <MessageSquare size={15} /> Get Quote for This Size
                  </a>
                </div>
              </div>

              {/* Size comparison */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-5">
                <h3 className="font-bold text-gray-900 text-sm mb-3">Alternative Sizes</h3>
                <div className="space-y-2">
                  {(form.conductor === 'copper' ? RATINGS_COPPER : RATINGS_ALUMINIUM)
                    .filter(r => r.size >= result.size)
                    .slice(0, 4)
                    .map(r => {
                      const isSelected = r.size === result.size
                      const A = r.size
                      const ρ = RESISTIVITY[form.conductor]
                      const I = result.current
                      const VD = form.phase === '3ph'
                        ? (Math.sqrt(3) * ρ * parseFloat(form.distance) * I) / A
                        : (2 * ρ * parseFloat(form.distance) * I) / A
                      const VDpct = Math.round((VD / parseFloat(form.voltage)) * 10000) / 100
                      return (
                        <div key={r.size}
                          className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-sm ${isSelected ? 'bg-brand-50 border border-brand-200' : 'border border-gray-100 hover:bg-gray-50'}`}>
                          <span className={`font-bold ${isSelected ? 'text-brand-700' : 'text-gray-700'}`}>{r.size} sq mm</span>
                          <span className="text-gray-500 text-xs">VD: {VDpct}%</span>
                          <span className={`text-xs font-semibold ${VDpct <= 5 ? 'text-emerald-600' : 'text-amber-600'}`}>{VDpct <= 5 ? '✓ OK' : '⚠ High VD'}</span>
                          {isSelected && <span className="text-[10px] font-bold text-brand-500 bg-brand-100 px-2 py-0.5 rounded-lg">Selected</span>}
                        </div>
                      )
                    })
                  }
                </div>
              </div>
            </>
          ) : (
            <div className="bg-white rounded-2xl border border-red-100 shadow-card p-6 text-center">
              <AlertTriangle size={36} className="text-red-400 mx-auto mb-3" />
              <p className="text-gray-600 font-medium">Please enter load (kW or Amps) and distance to calculate.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

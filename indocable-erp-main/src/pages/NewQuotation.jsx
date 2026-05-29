import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import toast from 'react-hot-toast'
import {
  calcQuotation, getDcResistance, getStandardThicknesses,
  generateDatasheet, buildDesignation, calcKLay,
} from '../lib/cableEngine'
import {
  getColorCode, getInnerSheathThickness, selectDrum,
  getPressureFillFactor, CONDUCTOR_FILL_FACTOR,
} from '../lib/standardsTables'
import {
  ArrowLeft, ArrowRight, Check, Save, Info, AlertTriangle,
  Zap, DollarSign, FileText, Package, Layers, Cable, Printer,
} from 'lucide-react'

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const STANDARDS = [
  { value: 'IS_694',      label: 'IS 694 (450/750V, House/Panel Wire)' },
  { value: 'IS_7098_P1',  label: 'IS 7098 Part 1 (1.1kV XLPE Armoured)' },
  { value: 'IS_1554_P1',  label: 'IS 1554 Part 1 (1.1kV PVC Armoured)' },
  { value: 'IS_17505_P1', label: 'IS 17505 Part 1 (1.1kV Flexible)' },
  { value: 'BN_50288_P7', label: 'BN 50288 Part 7 (Instrumentation)' },
]

const IS694_CATEGORIES = [
  { value: 'single_core_unsheathed', label: 'Single Core Unsheathed (House/Panel Wire)' },
  { value: 'multicore_sheathed',     label: 'Multi Core Sheathed (Flexible/Rigid)' },
  { value: 'flat_submersible',       label: 'Flat Submersible Cable' },
  { value: 'twin_parallel',          label: 'Twin Parallel / Speaker Wire (Unsheathed)' },
]

const ALL_SIZES         = [0.5, 0.75, 1, 1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240, 300, 400, 500, 630]
const IS694_FLAT_SIZES  = [0.5, 0.75, 1, 1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95]
const IS694_TWIN_SIZES  = [0.5, 0.75, 1, 1.5, 2.5, 4]
const ALL_N_CORES       = [1, 2, 3, 3.5, 4, 5, 6, 7, 8, 10, 12, 14, 19, 24]

const SIZES_BY_STANDARD = {
  IS_694:      [0.5, 0.75, 1, 1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240, 300],
  IS_7098_P1:  [1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240, 300, 400, 500, 630, 800, 1000],
  IS_1554_P1:  [1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240, 300, 400, 500, 630, 800, 1000],
  IS_17505_P1: [1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240, 300, 400, 500, 630],
  BN_50288_P7: [0.5, 0.75, 1, 1.5, 2.5],
}

const CONDUCTOR_CLASSES = [
  { value: 'class1', label: 'Class 1 (Solid)' },
  { value: 'class2', label: 'Class 2 (Stranded)' },
  { value: 'class5', label: 'Class 5 (Flexible)' },
  { value: 'class6', label: 'Class 6 (Extra Flex)' },
]

const FILL_FACTOR_DEFAULTS = {
  class1: { round: { uncompacted: 1.0,  compacted: 1.0  } },
  class2: { round: { uncompacted: 0.75, compacted: 0.90 }, sector: { uncompacted: 0.91, compacted: 0.91 } },
  class5: { round: { uncompacted: 0.74, compacted: 0.74 } },
  class6: { round: { uncompacted: 0.68, compacted: 0.68 } },
}

const DEFAULT_N_STRANDS  = { class1: 1, class2: 7, class5: 19, class6: 19 }
const DEFAULT_LAY_FACTOR = { class1: 10, class2: 15, class5: 15, class6: 15 }
const PACKING_OPTIONS    = [100, 200, 500, 1000]

const STEP_TITLES = [
  'Standard & Configuration',
  'Conductor',
  'Insulation',
  'Lay-Up & Binding',
  'Inner Sheath',
  'Armour & Outer Sheath',
  'Packing',
  'Quote & Summary',
]
const STEP_ICONS = [Cable, Zap, Layers, Package, Layers, Layers, Package, DollarSign]

// ─── INITIAL FORM STATE ───────────────────────────────────────────────────────

const INITIAL_FORM = {
  standard: 'IS_694',
  category: 'multicore_sheathed',
  insulation_subtype: 'XLPE',    // IS 17505: 'XLPE' | 'XL-HFFR'
  voltage_class: '500V',         // BN 50288: '90V' | '300V' | '500V' | '1100V'
  conductor_size: 2.5,
  n_cores: 3,
  order_km: 1,
  customer_name: '',
  project_name: '',

  conductor_material_id: null,
  conductor_material_name: '',
  conductor_density: 8.89,
  conductor_resistivity: 0.017241,
  conductor_temp_coeff: 0.00393,
  conductor_landed_cost: 0,
  conductor_class: 'class2',
  conductor_shape: 'round',
  conductor_compaction: 'uncompacted',
  n_strands: 7,
  lay_factor_cond: 15,
  lay_dir_cond: 'S',
  lay_factor_core: 30,
  lay_dir_core: 'Z',
  fill_factor: 0.75,
  R_max: 7.41,
  conductor_wastage: 1,

  insul_material_id: null,
  insul_material_name: '',
  insul_density: 1.5,
  insul_landed_cost: 0,
  t_insul: 0.8,
  t_insul_custom: false,
  color_code_custom: null,
  insul_wastage: 5,

  lay_factor_laidup: 30,
  lay_dir_laidup: 'Z',
  filler_type: 'none',
  filler_weight_per_km: 0,
  binder_type: 'none',
  binder_weight_per_km: 300,
  binding_tape_id: null,
  binding_tape_name: '',
  binding_tape_width: 10,
  binding_tape_overlap: 25,
  binding_tape_layers: 1,
  binding_tape_density: null,
  binding_tape_surface_density: null,
  binding_tape_landed_cost: 0,
  binding_tape_t: 0.25,

  has_inner_sheath: false,
  inner_sheath_material_id: null,
  inner_sheath_material_name: '',
  inner_sheath_density: 1.5,
  inner_sheath_landed_cost: 0,
  t_inner_sheath: null,
  inner_sheath_extrusion: 'tube',
  inner_sheath_wastage: 5,
  inner_sheath_color: 'Black',

  has_outer_sheath: true,
  outer_sheath_material_id: null,
  outer_sheath_material_name: '',
  outer_sheath_density: 1.5,
  outer_sheath_landed_cost: 0,
  t_outer_sheath: null,
  t_outer_sheath_custom: false,
  outer_sheath_extrusion: 'tube',
  outer_sheath_wastage: 5,
  outer_sheath_color: 'BLACK',
  armour_type: 'none',
  armour_material_id: null,
  armour_material_name: '',
  armour_density: 7.85,
  armour_landed_cost: 0,
  arm_packing: 0.9,

  has_braid: false,
  braid_n_carriers: 8,
  braid_n_wires: 8,
  braid_angle: 45,
  braid_density: 8.9,
  braid_landed_cost: 0,

  packing_length_m: 500,
  drum_material: 'wood',

  profit_margin_pct: 15,
  notes: '',
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function fmt(val, dec = 2) {
  if (val == null || isNaN(val)) return '—'
  return Number(val).toFixed(dec)
}

function fmtCost(val) {
  if (val == null || isNaN(val)) return '—'
  return '₹' + Number(val).toLocaleString('en-IN', { maximumFractionDigits: 2 })
}

function getSuggestedFillFactor(cls, shape, compaction) {
  return FILL_FACTOR_DEFAULTS[cls]?.[shape]?.[compaction]
    ?? FILL_FACTOR_DEFAULTS[cls]?.round?.uncompacted
    ?? 0.75
}

function getValidSizes(standard, category) {
  if (standard === 'IS_694') {
    if (category === 'flat_submersible') return IS694_FLAT_SIZES
    if (category === 'twin_parallel')    return IS694_TWIN_SIZES
  }
  return SIZES_BY_STANDARD[standard] ?? ALL_SIZES
}

function getValidNCores(standard, category) {
  if (standard === 'IS_694') {
    if (category === 'single_core_unsheathed') return [1]
    if (category === 'flat_submersible')       return [2, 3]
    if (category === 'twin_parallel')          return [2]
  }
  return ALL_N_CORES
}

function shouldShowOuterSheath(form) {
  if (form.standard === 'IS_694') {
    if (form.category === 'single_core_unsheathed') return false
    if (form.category === 'twin_parallel')          return false
  }
  return true
}

function shouldShowLaidup(form) {
  return Number(form.n_cores) !== 1
}

function getDcrClass(conductorClass) {
  return conductorClass.replace('class', 'cl')
}

// ─── MATERIAL COMBOBOX ────────────────────────────────────────────────────────

function MaterialCombobox({ label, materials, value, onSelect, placeholder }) {
  const [query, setQuery] = useState(value || '')
  const [open, setOpen]   = useState(false)
  const ref               = useRef(null)

  useEffect(() => { setQuery(value || '') }, [value])

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const filtered = query.length === 0
    ? materials
    : materials.filter(m => m.name.toLowerCase().includes(query.toLowerCase()))

  return (
    <div className="relative" ref={ref}>
      <label className="text-xs font-medium text-gray-500 mb-1 block">{label}</label>
      <input
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30"
        placeholder={placeholder || 'Search material...'}
        value={query}
        onChange={e => { setQuery(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {filtered.map(m => (
            <button
              key={m.id}
              type="button"
              className="w-full text-left px-3 py-2 text-sm hover:bg-brand-50 flex justify-between items-center"
              onMouseDown={() => { onSelect(m); setQuery(m.name); setOpen(false) }}
            >
              <span className="font-medium text-gray-800">{m.name}</span>
              {m.landed_cost != null && (
                <span className="text-gray-400 text-xs ml-2">
                  {'₹'}{Number(m.landed_cost).toFixed(2)}/kg
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── PRIMITIVES ───────────────────────────────────────────────────────────────

function Field({ label, children, hint }) {
  return (
    <div>
      <label className="text-xs font-medium text-gray-500 mb-1 block">{label}</label>
      {children}
      {hint && <p className="text-xs text-gray-400 mt-0.5">{hint}</p>}
    </div>
  )
}

function FInput({ className, ...props }) {
  return (
    <input
      className={`w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 disabled:bg-gray-50 disabled:text-gray-400 ${className || ''}`}
      {...props}
    />
  )
}

function FSelect({ children, ...props }) {
  return (
    <select
      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 bg-white"
      {...props}
    >
      {children}
    </select>
  )
}

function SectionHeader({ children }) {
  return (
    <h3 className="text-sm font-semibold text-gray-700 mb-3 mt-5 first:mt-0 border-b border-gray-100 pb-1">
      {children}
    </h3>
  )
}

function CalcRow({ label, value, unit, highlight }) {
  return (
    <div className={`flex justify-between items-center py-1.5 px-2 rounded ${highlight ? 'bg-brand-50' : ''}`}>
      <span className="text-xs text-gray-500">{label}</span>
      <span className={`text-xs font-semibold ${highlight ? 'text-brand-700' : 'text-gray-700'}`}>
        {value}
        {unit ? <span className="font-normal text-gray-400 ml-1">{unit}</span> : null}
      </span>
    </div>
  )
}

// ─── PROGRESS BAR ─────────────────────────────────────────────────────────────

function StepBar({ step, maxReached, onStep }) {
  return (
    <div className="flex items-start gap-1 overflow-x-auto pb-1 scrollbar-none">
      {STEP_TITLES.map((title, i) => {
        const n       = i + 1
        const done    = n < step
        const current = n === step
        const locked  = n > maxReached + 1
        return (
          <button
            key={n}
            onClick={() => !locked && onStep(n)}
            disabled={locked}
            title={title}
            className={`flex flex-col items-center gap-1 min-w-[68px] px-1 py-2 rounded-xl transition-all
              ${current
                ? 'bg-brand-500 text-white'
                : done
                  ? 'bg-brand-100 text-brand-700 hover:bg-brand-200 cursor-pointer'
                  : locked
                    ? 'text-gray-300 cursor-not-allowed'
                    : 'text-gray-500 hover:bg-gray-100 cursor-pointer'
              }`}
          >
            <span
              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border-2
                ${current
                  ? 'border-white bg-white text-brand-600'
                  : done
                    ? 'border-brand-400 bg-indigo-400 text-white'
                    : 'border-current'
                }`}
            >
              {done ? <Check size={12} /> : n}
            </span>
            <span className="text-[10px] font-medium leading-tight text-center" style={{ maxWidth: 64 }}>
              {title}
            </span>
          </button>
        )
      })}
    </div>
  )
}

// ─── LIVE RESULT PANEL ────────────────────────────────────────────────────────

function ResultPanel({ form, result, calcError, designation }) {
  const has = result && !calcError

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 sticky top-4">
      <h2 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
        <Zap size={15} className="text-brand-500" />
        Live Calculation
      </h2>

      {calcError && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3 flex items-start gap-2">
          <AlertTriangle size={14} className="text-red-500 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-red-600 break-words">{calcError}</p>
        </div>
      )}

      <div className="font-mono text-sm font-bold text-brand-700 bg-brand-50 rounded-lg px-3 py-2 mb-3 break-all min-h-[36px]">
        {designation || <span className="text-brand-300 font-normal">filling...</span>}
      </div>

      <div className="space-y-0.5">
        <CalcRow label="Overall OD"          value={has ? fmt(result.overall_dia)                  : '—'} unit="mm"    />
        <CalcRow label="Conductor OD"        value={has ? fmt(result.conductor_od)                  : '—'} unit="mm"    />
        <CalcRow label="Dia over Insul"      value={has ? fmt(result.dia_over_insul)                : '—'} unit="mm"    />
        <CalcRow label="Dia over Laid-up"    value={has ? fmt(result.dia_over_laidup)               : '—'} unit="mm"    />
        <CalcRow label="Total Weight"        value={has ? fmt(result.wt_total_per_km)               : '—'} unit="kg/km" />
        <CalcRow label="Conductor Wt"        value={has ? fmt(result.wt_conductor_per_km)           : '—'} unit="kg/km" />
        <CalcRow label="Insulation Wt"       value={has ? fmt(result.wt_insul_per_km)               : '—'} unit="kg/km" />
        <CalcRow label="Outer Sheath Wt"     value={has ? fmt(result.wt_outer_sheath_per_km)        : '—'} unit="kg/km" />
        <CalcRow label="Drum"                value={has ? (result.drum_label || '—')                : '—'}              />
        <div className="border-t border-gray-100 mt-2 pt-2 space-y-0.5">
          <CalcRow label="Quote per meter"   value={has ? fmtCost(result.quote_per_m_with_packing)  : '—'} highlight />
          <CalcRow label="Quote per km"      value={has ? fmtCost(result.quote_per_km)              : '—'} highlight />
          <CalcRow label="Total for order"   value={has ? fmtCost(result.quote_total)               : '—'} highlight />
        </div>
      </div>

      <p className="mt-3 text-[10px] text-gray-400 text-center">Updates as you type</p>
    </div>
  )
}

// ─── STEP 1 ───────────────────────────────────────────────────────────────────

function Step1({ form, setForm }) {
  const validSizes = getValidSizes(form.standard, form.category)
  const validCores = getValidNCores(form.standard, form.category)

  function handleStandardChange(std) {
    const sizes = getValidSizes(std, form.category)
    const cores = getValidNCores(std, form.category)
    const armoured = ['IS_7098_P1', 'IS_1554_P1', 'IS_17505_P1'].includes(std)
    setForm(f => ({
      ...f,
      standard:       std,
      conductor_size: sizes.includes(f.conductor_size) ? f.conductor_size : sizes[0],
      n_cores:        cores.includes(f.n_cores)        ? f.n_cores        : cores[0],
      has_inner_sheath: ['IS_7098_P1', 'IS_1554_P1', 'IS_17505_P1', 'BN_50288_P7'].includes(std),
      armour_type:    armoured ? 'wire' : 'none',
      t_insul_custom: false,
      t_outer_sheath_custom: false,
    }))
  }

  function handleCategoryChange(cat) {
    const sizes = getValidSizes(form.standard, cat)
    const cores = getValidNCores(form.standard, cat)
    setForm(f => ({
      ...f,
      category:       cat,
      conductor_size: sizes.includes(f.conductor_size) ? f.conductor_size : sizes[0],
      n_cores:        cores.includes(f.n_cores)        ? f.n_cores        : cores[0],
    }))
  }

  return (
    <div className="space-y-4">
      <SectionHeader>Standard &amp; Cable Type</SectionHeader>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Standard *">
          <FSelect value={form.standard} onChange={e => handleStandardChange(e.target.value)}>
            {STANDARDS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </FSelect>
        </Field>

        {form.standard === 'IS_694' && (
          <Field label="Cable Category *">
            <FSelect value={form.category} onChange={e => handleCategoryChange(e.target.value)}>
              {IS694_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </FSelect>
          </Field>
        )}

        {form.standard === 'IS_17505_P1' && (
          <Field label="Insulation Subtype *">
            <FSelect value={form.insulation_subtype} onChange={e => setForm(f => ({ ...f, insulation_subtype: e.target.value, t_insul_custom: false }))}>
              <option value="XLPE">XLPE (Cross-linked Polyethylene)</option>
              <option value="XL-HFFR">XL-HFFR (Halogen-Free Flame Retardant)</option>
            </FSelect>
          </Field>
        )}

        {form.standard === 'BN_50288_P7' && (
          <Field label="Voltage Class *" hint="Determines insulation thickness per BN 50288">
            <FSelect value={form.voltage_class} onChange={e => setForm(f => ({ ...f, voltage_class: e.target.value, t_insul_custom: false }))}>
              <option value="90V">90V (Instrumentation low voltage)</option>
              <option value="300V">300V (Control circuit)</option>
              <option value="500V">500V (Standard control)</option>
              <option value="1100V">1100V (High voltage control)</option>
            </FSelect>
          </Field>
        )}

        <Field label="Conductor Size (mm²) *">
          <FSelect value={form.conductor_size} onChange={e => setForm(f => ({ ...f, conductor_size: Number(e.target.value) }))}>
            {validSizes.map(s => <option key={s} value={s}>{s} mm²</option>)}
          </FSelect>
        </Field>

        <Field label="Number of Cores *">
          <FSelect value={form.n_cores} onChange={e => setForm(f => ({ ...f, n_cores: Number(e.target.value) }))}>
            {validCores.map(c => (
              <option key={c} value={c}>{c === 3.5 ? '3½' : c} Core{c !== 1 ? 's' : ''}</option>
            ))}
          </FSelect>
        </Field>

        <Field label="Order Quantity (km) *">
          <FInput
            type="number" min="0.001" step="0.1"
            value={form.order_km}
            onChange={e => setForm(f => ({ ...f, order_km: Number(e.target.value) }))}
          />
        </Field>
      </div>

      <SectionHeader>Customer Details</SectionHeader>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Customer Name">
          <FInput
            value={form.customer_name}
            onChange={e => setForm(f => ({ ...f, customer_name: e.target.value }))}
            placeholder="e.g. Infosys Ltd"
          />
        </Field>
        <Field label="Project Name">
          <FInput
            value={form.project_name}
            onChange={e => setForm(f => ({ ...f, project_name: e.target.value }))}
            placeholder="e.g. Pune Data Centre"
          />
        </Field>
      </div>
    </div>
  )
}

// ─── LIVE MARKET PRICES HOOK ─────────────────────────────────────────────────

function useLiveMarketPrices() {
  const [prices, setPrices] = useState(null)
  useEffect(() => {
    supabase
      .from('global_variables')
      .select('key, value')
      .in('key', ['lme_usd_per_tonne', 'lme_premium_usd', 'usd_to_inr', 'lme_aluminum_usd', 'gi_wire_price'])
      .then(({ data }) => {
        if (!data) return
        const m = Object.fromEntries(data.map(v => [v.key, parseFloat(v.value) || 0]))
        const rate  = m.usd_to_inr  || 84
        const lmeCu = (m.lme_usd_per_tonne || 0) + (m.lme_premium_usd || 0)
        const lmeAl = m.lme_aluminum_usd || 0
        setPrices({
          copper_rs_kg:    lmeCu  > 0 ? (lmeCu  * rate / 1000) : null,
          aluminum_rs_kg:  lmeAl  > 0 ? (lmeAl  * rate / 1000) : null,
          gi_wire_rs_kg:   m.gi_wire_price || null,
          usd_inr:         rate,
          lme_cu_usd:      lmeCu  > 0 ? lmeCu  : null,
          lme_al_usd:      lmeAl  > 0 ? lmeAl  : null,
        })
      })
  }, [])
  return prices
}

// ─── STEP 2 ───────────────────────────────────────────────────────────────────

function Step2({ form, setForm, bomMaterials, result }) {
  const conductors = bomMaterials.filter(m => m.category === 'conductor')
  const liveP = useLiveMarketPrices()

  function getLivePriceForMaterial(name) {
    if (!liveP) return null
    const n = name.toLowerCase()
    if (n.includes('copper')) return liveP.copper_rs_kg
    if (n.includes('alumin')) return liveP.aluminum_rs_kg
    if (n.includes('gi') || n.includes('iron') || n.includes('galvan')) return liveP.gi_wire_rs_kg
    return null
  }

  function handleMaterialSelect(m) {
    const dcr = getDcResistance(form.conductor_size, m.name, getDcrClass(form.conductor_class))
    setForm(f => ({
      ...f,
      conductor_material_id:   m.id,
      conductor_material_name: m.name,
      conductor_density:       m.density     ?? 8.89,
      conductor_resistivity:   m.resistivity ?? 0.017241,
      conductor_temp_coeff:    m.temp_coeff  ?? 0.00393,
      conductor_landed_cost:   m.landed_cost ?? 0,
      R_max: dcr ?? f.R_max,
    }))
  }

  function handleClassChange(cls) {
    const ff  = getSuggestedFillFactor(cls, form.conductor_shape, form.conductor_compaction)
    const dcr = getDcResistance(form.conductor_size, form.conductor_material_name, getDcrClass(cls))
    setForm(f => ({
      ...f,
      conductor_class:  cls,
      n_strands:        DEFAULT_N_STRANDS[cls] ?? 7,
      lay_factor_cond:  DEFAULT_LAY_FACTOR[cls] ?? 15,
      fill_factor:      ff,
      R_max:            dcr ?? f.R_max,
    }))
  }

  function handleShapeOrCompaction(key, val) {
    setForm(f => {
      const next = { ...f, [key]: val }
      return { ...next, fill_factor: getSuggestedFillFactor(next.conductor_class, next.conductor_shape, next.conductor_compaction) }
    })
  }

  const K_lay_cond = result?.K_lay_cond ?? (form.n_strands <= 1 ? 1.0 : calcKLay(form.lay_factor_cond, form.n_strands))
  const K_lay_core = result?.K_lay_core ?? calcKLay(form.lay_factor_core, form.n_cores)

  return (
    <div className="space-y-4">
      <SectionHeader>Conductor Material</SectionHeader>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <MaterialCombobox
            label="Conductor Material *"
            materials={conductors}
            value={form.conductor_material_name}
            onSelect={handleMaterialSelect}
            placeholder="Search copper, aluminium..."
          />
        </div>
        <Field label="Density (g/cm³)">
          <FInput type="number" step="0.001" value={form.conductor_density}
            onChange={e => setForm(f => ({ ...f, conductor_density: Number(e.target.value) }))} />
        </Field>
        <Field label="Resistivity (Ω·mm²/m)">
          <FInput type="number" step="0.000001" value={form.conductor_resistivity}
            onChange={e => setForm(f => ({ ...f, conductor_resistivity: Number(e.target.value) }))} />
        </Field>
        <Field label="Temp Coefficient (/°C)">
          <FInput type="number" step="0.00001" value={form.conductor_temp_coeff}
            onChange={e => setForm(f => ({ ...f, conductor_temp_coeff: Number(e.target.value) }))} />
        </Field>
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block">Landed Cost (₹/kg)</label>
          <div className="flex gap-2 items-center">
            <FInput type="number" step="0.01" value={form.conductor_landed_cost}
              onChange={e => setForm(f => ({ ...f, conductor_landed_cost: Number(e.target.value) }))}
              className="flex-1"
            />
            {getLivePriceForMaterial(form.conductor_material_name) != null && (
              <button
                type="button"
                title={`Use live market price: ₹${Math.round(getLivePriceForMaterial(form.conductor_material_name))}/kg`}
                onClick={() => setForm(f => ({ ...f, conductor_landed_cost: Math.round(getLivePriceForMaterial(form.conductor_material_name)) }))}
                className="shrink-0 text-xs bg-emerald-500 hover:bg-emerald-600 text-white px-2 py-2 rounded-lg transition-colors"
              >
                ₹{Math.round(getLivePriceForMaterial(form.conductor_material_name))}↙
              </button>
            )}
          </div>
          {liveP && (
            <p className="text-[10px] text-gray-400 mt-0.5">
              Live — Cu: ₹{liveP.copper_rs_kg ? Math.round(liveP.copper_rs_kg) : '—'} &nbsp;
              Al: ₹{liveP.aluminum_rs_kg ? Math.round(liveP.aluminum_rs_kg) : '—'} &nbsp;
              GI: ₹{liveP.gi_wire_rs_kg ? Math.round(liveP.gi_wire_rs_kg) : '—'} &nbsp;
              USD: ₹{liveP.usd_inr?.toFixed(1) || '—'}
            </p>
          )}
        </div>
      </div>

      <SectionHeader>Conductor Construction</SectionHeader>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Conductor Class *">
          <FSelect value={form.conductor_class} onChange={e => handleClassChange(e.target.value)}>
            {CONDUCTOR_CLASSES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </FSelect>
        </Field>

        {form.conductor_class === 'class2' && (
          <Field label="Conductor Shape">
            <FSelect value={form.conductor_shape}
              onChange={e => handleShapeOrCompaction('conductor_shape', e.target.value)}>
              <option value="round">Round</option>
              <option value="sector">Sector</option>
            </FSelect>
          </Field>
        )}

        {form.conductor_class === 'class2' && (
          <Field label="Compaction">
            <FSelect value={form.conductor_compaction}
              onChange={e => handleShapeOrCompaction('conductor_compaction', e.target.value)}>
              <option value="uncompacted">Uncompacted</option>
              <option value="compacted">Compacted</option>
            </FSelect>
          </Field>
        )}

        <Field label="Number of Strands">
          <FInput type="number" min="1" value={form.n_strands}
            onChange={e => setForm(f => ({ ...f, n_strands: Number(e.target.value) }))} />
        </Field>
        <Field label="Lay Factor — Conductor" hint="Lay length / diameter ratio">
          <FInput type="number" step="0.1" value={form.lay_factor_cond}
            onChange={e => setForm(f => ({ ...f, lay_factor_cond: Number(e.target.value) }))} />
        </Field>
        <Field label="Lay Direction — Conductor">
          <FSelect value={form.lay_dir_cond} onChange={e => setForm(f => ({ ...f, lay_dir_cond: e.target.value }))}>
            <option value="S">S</option>
            <option value="Z">Z</option>
          </FSelect>
        </Field>
        <Field label="Lay Factor — Core" hint="Helical twist of core in cable">
          <FInput type="number" step="0.1" value={form.lay_factor_core}
            onChange={e => setForm(f => ({ ...f, lay_factor_core: Number(e.target.value) }))} />
        </Field>
        <Field label="Lay Direction — Core">
          <FSelect value={form.lay_dir_core} onChange={e => setForm(f => ({ ...f, lay_dir_core: e.target.value }))}>
            <option value="S">S</option>
            <option value="Z">Z</option>
          </FSelect>
        </Field>
        <Field label="Fill Factor" hint="Auto-suggested — editable">
          <FInput type="number" step="0.01" min="0.1" max="1.0" value={form.fill_factor}
            onChange={e => setForm(f => ({ ...f, fill_factor: Number(e.target.value) }))} />
        </Field>
        <Field label="DC Resistance Max (Ω/km)" hint="From IS 8130 — editable">
          <FInput type="number" step="0.0001" value={form.R_max}
            onChange={e => setForm(f => ({ ...f, R_max: Number(e.target.value) }))} />
        </Field>
        <Field label="Conductor Wastage (%)">
          <FInput type="number" step="0.1" min="0" value={form.conductor_wastage}
            onChange={e => setForm(f => ({ ...f, conductor_wastage: Number(e.target.value) }))} />
        </Field>
      </div>

      <SectionHeader>Live Conductor Calculations</SectionHeader>
      <div className="bg-gray-50 rounded-lg p-3 space-y-0.5">
        <CalcRow label="K_lay Conductor"        value={fmt(K_lay_cond, 5)} />
        <CalcRow label="K_lay Core"             value={fmt(K_lay_core, 5)} />
        <CalcRow label="Strand Diameter"        value={fmt(result?.strand_dia, 4)}                  unit="mm"    />
        <CalcRow label="Conductor OD"           value={fmt(result?.conductor_od, 3)}                unit="mm"    highlight />
        <CalcRow label="Weight/km/core"         value={fmt(result?.wt_conductor_per_km_per_core)}   unit="kg/km" />
        <CalcRow label="Total Conductor Weight" value={fmt(result?.wt_conductor_total)}             unit="kg"    />
      </div>
    </div>
  )
}

// ─── STEP 3 ───────────────────────────────────────────────────────────────────

function Step3({ form, setForm, bomMaterials, result }) {
  const insulations = bomMaterials.filter(m => m.category === 'insulation')

  function handleMaterialSelect(m) {
    setForm(f => ({
      ...f,
      insul_material_id:   m.id,
      insul_material_name: m.name,
      insul_density:       m.density     ?? 1.5,
      insul_landed_cost:   m.landed_cost ?? 0,
    }))
  }

  const colorCodes = form.color_code_custom ?? getColorCode(form.n_cores)
  const nCoresInt  = Math.round(Number(form.n_cores))

  function setColorCode(idx, val) {
    const arr = [...colorCodes]
    arr[idx]  = val
    setForm(f => ({ ...f, color_code_custom: arr }))
  }

  return (
    <div className="space-y-4">
      <SectionHeader>Insulation Material</SectionHeader>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <MaterialCombobox
            label="Insulation Material *"
            materials={insulations}
            value={form.insul_material_name}
            onSelect={handleMaterialSelect}
            placeholder="Search PVC, XLPE, FRLS..."
          />
        </div>
        <Field label="Density (g/cm³)">
          <FInput type="number" step="0.001" value={form.insul_density}
            onChange={e => setForm(f => ({ ...f, insul_density: Number(e.target.value) }))} />
        </Field>
        <Field label="Landed Cost (₹/kg)">
          <FInput type="number" step="0.01" value={form.insul_landed_cost}
            onChange={e => setForm(f => ({ ...f, insul_landed_cost: Number(e.target.value) }))} />
        </Field>
      </div>

      <SectionHeader>Thickness</SectionHeader>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label={form.t_insul_custom ? 'Insulation Thickness Nom (mm) — custom' : 'Insulation Thickness Nom (mm) — from standard'}>
          <div className="relative">
            <FInput
              type="number" step="0.1" min="0.1"
              value={form.t_insul}
              onChange={e => setForm(f => ({ ...f, t_insul: Number(e.target.value), t_insul_custom: true }))}
              className={form.t_insul_custom ? 'border-yellow-400' : ''}
            />
            {form.t_insul_custom && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                <AlertTriangle size={14} className="text-yellow-500" />
              </span>
            )}
          </div>
          {form.t_insul_custom && (
            <p className="text-xs text-yellow-600 mt-0.5 flex items-center gap-1">
              <AlertTriangle size={11} /> Custom value — differs from standard table
            </p>
          )}
        </Field>
        <Field label="Min Thickness (mm) — nom × 0.8">
          <FInput type="text" value={fmt(form.t_insul * 0.8)} disabled />
        </Field>
        <Field label="Insulation Wastage (%)">
          <FInput type="number" step="0.1" min="0" value={form.insul_wastage}
            onChange={e => setForm(f => ({ ...f, insul_wastage: Number(e.target.value) }))} />
        </Field>
      </div>

      <SectionHeader>Color Code per Core</SectionHeader>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {Array.from({ length: nCoresInt }, (_, i) => (
          <Field key={i} label={`Core ${i + 1}`}>
            <FInput value={colorCodes[i] ?? ''} onChange={e => setColorCode(i, e.target.value)} />
          </Field>
        ))}
      </div>

      <SectionHeader>Live Insulation Calculations</SectionHeader>
      <div className="bg-gray-50 rounded-lg p-3 space-y-0.5">
        <CalcRow label="Dia over Insulation"  value={fmt(result?.dia_over_insul)}              unit="mm"    highlight />
        <CalcRow label="Weight/km/core"       value={fmt(result?.wt_insul_per_km_per_core)}    unit="kg/km" />
        <CalcRow label="Total Insulation Wt"  value={fmt(result?.wt_insul_total)}              unit="kg"    />
      </div>
    </div>
  )
}

// ─── STEP 4 ───────────────────────────────────────────────────────────────────

function Step4({ form, setForm, bomMaterials, result }) {
  const tapes = bomMaterials.filter(m => m.category === 'tape')

  if (!shouldShowLaidup(form)) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-400">
        <Layers size={40} className="mb-3 opacity-40" />
        <p className="text-sm font-medium">Single core — no lay-up needed</p>
        <p className="text-xs mt-1">Proceed to the next step.</p>
      </div>
    )
  }

  function handleTapeSelect(m) {
    setForm(f => ({
      ...f,
      binding_tape_id:              m.id,
      binding_tape_name:            m.name,
      binding_tape_density:         m.density          ?? null,
      binding_tape_surface_density: m.surface_density  ?? null,
      binding_tape_landed_cost:     m.landed_cost       ?? 0,
    }))
  }

  return (
    <div className="space-y-4">
      <SectionHeader>Laid-Up Configuration</SectionHeader>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Lay Factor for Laid-Up">
          <FInput type="number" step="0.1" value={form.lay_factor_laidup}
            onChange={e => setForm(f => ({ ...f, lay_factor_laidup: Number(e.target.value) }))} />
        </Field>
        <Field label="Lay Direction">
          <FSelect value={form.lay_dir_laidup} onChange={e => setForm(f => ({ ...f, lay_dir_laidup: e.target.value }))}>
            <option value="S">S</option>
            <option value="Z">Z</option>
          </FSelect>
        </Field>
      </div>

      <SectionHeader>Filler &amp; Binder</SectionHeader>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Filler">
          <FSelect value={form.filler_type} onChange={e => setForm(f => ({ ...f, filler_type: e.target.value }))}>
            <option value="none">None</option>
            <option value="wbr">WBR</option>
            <option value="pvc_rope">PVC Filler Rope</option>
            <option value="pp_filler">PP Filler</option>
          </FSelect>
        </Field>
        {form.filler_type !== 'none' && (
          <Field label="Filler Weight (kg/km)">
            <FInput type="number" step="0.1" value={form.filler_weight_per_km}
              onChange={e => setForm(f => ({ ...f, filler_weight_per_km: Number(e.target.value) }))} />
          </Field>
        )}
        <Field label="Binder">
          <FSelect
            value={form.binder_type}
            onChange={e => setForm(f => ({
              ...f,
              binder_type:         e.target.value,
              binder_weight_per_km: e.target.value === 'binder_yarn' ? 300 : 0,
            }))}
          >
            <option value="none">None</option>
            <option value="binder_yarn">Binder Yarn</option>
          </FSelect>
        </Field>
        {form.binder_type !== 'none' && (
          <Field label="Binder Weight (kg/km)">
            <FInput type="number" step="1" value={form.binder_weight_per_km}
              onChange={e => setForm(f => ({ ...f, binder_weight_per_km: Number(e.target.value) }))} />
          </Field>
        )}
      </div>

      <SectionHeader>Binding Tape</SectionHeader>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <MaterialCombobox
            label="Binding Tape Material"
            materials={tapes}
            value={form.binding_tape_name}
            onSelect={handleTapeSelect}
            placeholder="Search polyester tape..."
          />
        </div>
        <Field label="Tape Width (mm)">
          <FInput type="number" step="1" value={form.binding_tape_width}
            onChange={e => setForm(f => ({ ...f, binding_tape_width: Number(e.target.value) }))} />
        </Field>
        <Field label="Tape Overlap (%)">
          <FInput type="number" step="1" min="0" max="80" value={form.binding_tape_overlap}
            onChange={e => setForm(f => ({ ...f, binding_tape_overlap: Number(e.target.value) }))} />
        </Field>
        <Field label="Tape Layers">
          <FInput type="number" step="1" min="1" value={form.binding_tape_layers}
            onChange={e => setForm(f => ({ ...f, binding_tape_layers: Number(e.target.value) }))} />
        </Field>
        <Field label="Tape Thickness (mm)">
          <FInput type="number" step="0.01" value={form.binding_tape_t}
            onChange={e => setForm(f => ({ ...f, binding_tape_t: Number(e.target.value) }))} />
        </Field>
      </div>

      <SectionHeader>Live Lay-Up Calculations</SectionHeader>
      <div className="bg-gray-50 rounded-lg p-3 space-y-0.5">
        <CalcRow label="Dia over Laid-up"  value={fmt(result?.dia_over_laidup)}   unit="mm"    highlight />
        <CalcRow label="Dia over Binding"  value={fmt(result?.dia_over_binding)}  unit="mm"    />
        <CalcRow label="Binding Tape Wt"   value={fmt(result?.wt_binding_per_km)} unit="kg/km" />
      </div>
    </div>
  )
}

// ─── STEP 5 ───────────────────────────────────────────────────────────────────

function Step5({ form, setForm, bomMaterials, result }) {
  const sheathMats = bomMaterials.filter(m => m.category === 'sheathing')

  function handleMaterialSelect(m) {
    setForm(f => ({
      ...f,
      inner_sheath_material_id:   m.id,
      inner_sheath_material_name: m.name,
      inner_sheath_density:       m.density     ?? 1.5,
      inner_sheath_landed_cost:   m.landed_cost ?? 0,
    }))
  }

  const suggestedT = result?.dia_over_laidup != null
    ? getInnerSheathThickness(result.dia_over_laidup, form.standard)
    : null

  return (
    <div className="space-y-4">
      <SectionHeader>Inner Sheath</SectionHeader>

      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
        <button
          type="button"
          onClick={() => setForm(f => ({ ...f, has_inner_sheath: !f.has_inner_sheath }))}
          className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none
            ${form.has_inner_sheath ? 'bg-brand-500' : 'bg-gray-300'}`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform
              ${form.has_inner_sheath ? 'translate-x-6' : 'translate-x-1'}`}
          />
        </button>
        <span className="text-sm font-medium text-gray-700">
          {form.has_inner_sheath ? 'Inner Sheath Enabled' : 'No Inner Sheath'}
        </span>
      </div>

      {form.has_inner_sheath ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <MaterialCombobox
              label="Inner Sheath Material *"
              materials={sheathMats}
              value={form.inner_sheath_material_name}
              onSelect={handleMaterialSelect}
              placeholder="Search PVC compound..."
            />
          </div>
          <Field label="Extrusion Type">
            <FSelect value={form.inner_sheath_extrusion}
              onChange={e => setForm(f => ({ ...f, inner_sheath_extrusion: e.target.value }))}>
              <option value="tube">Tube</option>
              <option value="pressure">Pressure</option>
            </FSelect>
          </Field>
          <Field label={suggestedT != null ? `Thickness (mm) — suggested ${suggestedT}` : 'Thickness (mm)'}>
            <FInput
              type="number" step="0.1" min="0.1"
              value={form.t_inner_sheath ?? suggestedT ?? 0.5}
              onChange={e => setForm(f => ({ ...f, t_inner_sheath: Number(e.target.value) }))}
            />
          </Field>
          <Field label="Inner Sheath Wastage (%)">
            <FInput type="number" step="0.1" min="0" value={form.inner_sheath_wastage}
              onChange={e => setForm(f => ({ ...f, inner_sheath_wastage: Number(e.target.value) }))} />
          </Field>
          <Field label="Color">
            <FInput value={form.inner_sheath_color}
              onChange={e => setForm(f => ({ ...f, inner_sheath_color: e.target.value }))} />
          </Field>
          <Field label="Landed Cost (₹/kg)">
            <FInput type="number" step="0.01" value={form.inner_sheath_landed_cost}
              onChange={e => setForm(f => ({ ...f, inner_sheath_landed_cost: Number(e.target.value) }))} />
          </Field>

          <div className="sm:col-span-2">
            <SectionHeader>Live Inner Sheath Calculations</SectionHeader>
            <div className="bg-gray-50 rounded-lg p-3 space-y-0.5">
              <CalcRow label="Dia over Inner Sheath" value={fmt(result?.dia_over_inner_sheath)} unit="mm"    highlight />
              <CalcRow label="Inner Sheath Wt"       value={fmt(result?.wt_inner_sheath_per_km)} unit="kg/km" />
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-10 text-gray-400">
          <Info size={32} className="mb-2 opacity-40" />
          <p className="text-sm">Toggle above to add an inner sheath</p>
        </div>
      )}
    </div>
  )
}

// ─── STEP 6 ───────────────────────────────────────────────────────────────────

function Step6({ form, setForm, bomMaterials, result }) {
  const sheathMats  = bomMaterials.filter(m => m.category === 'sheathing')
  const armourMats  = bomMaterials.filter(m => ['armour', 'wire', 'gi_wire'].includes(m.category))
  const showSheath  = shouldShowOuterSheath(form)
  const pfFactor    = getPressureFillFactor(form.n_cores, form.outer_sheath_extrusion, form.standard)
  const liveP       = useLiveMarketPrices()

  function handleSheathSelect(m) {
    setForm(f => ({
      ...f,
      outer_sheath_material_id:   m.id,
      outer_sheath_material_name: m.name,
      outer_sheath_density:       m.density     ?? 1.5,
      outer_sheath_landed_cost:   m.landed_cost ?? 0,
    }))
  }

  function handleArmourSelect(m) {
    setForm(f => ({
      ...f,
      armour_material_id:   m.id,
      armour_material_name: m.name,
      armour_density:       m.density     ?? 7.85,
      armour_landed_cost:   m.landed_cost ?? 0,
    }))
  }

  if (!showSheath) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-400">
        <Layers size={40} className="mb-3 opacity-40" />
        <p className="text-sm font-medium">No outer sheath for this cable type</p>
        <p className="text-xs mt-1">Single core unsheathed / Twin parallel cables have no outer sheath.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <SectionHeader>Armour</SectionHeader>
      {form.standard === 'IS_694' ? (
        <div className="flex items-start gap-2.5 p-3 bg-amber-50 border border-amber-100 rounded-xl text-sm text-amber-800">
          <Info size={15} className="flex-shrink-0 mt-0.5" />
          <span><strong>IS 694</strong> cables are unarmoured — the standard does not include any armoured construction. Armour is not applicable.</span>
        </div>
      ) : (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Armour Type" hint={form.standard === 'IS_7098_P1' ? 'Per IS 7098 P1' : form.standard === 'IS_1554_P1' ? 'Per IS 1554 P1' : form.standard === 'IS_17505_P1' ? 'Per IS 17505 P1' : ''}>
          <FSelect value={form.armour_type} onChange={e => setForm(f => ({ ...f, armour_type: e.target.value }))}>
            <option value="none">None (Unarmoured)</option>
            <option value="wire">Round Wire Armour (GI Wire)</option>
            <option value="strip">Steel Strip Armour (MS Strip)</option>
          </FSelect>
        </Field>

        {form.armour_type !== 'none' && (
          <>
            <div className="sm:col-span-2">
              <MaterialCombobox
                label="Armour Material"
                materials={armourMats}
                value={form.armour_material_name}
                onSelect={handleArmourSelect}
                placeholder="Search GI wire, MS strip..."
              />
            </div>
            <Field label="Armour Density (g/cm³)">
              <FInput type="number" step="0.01" value={form.armour_density}
                onChange={e => setForm(f => ({ ...f, armour_density: Number(e.target.value) }))} />
            </Field>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Landed Cost (₹/kg)</label>
              <div className="flex gap-2 items-center">
                <FInput type="number" step="0.01" value={form.armour_landed_cost}
                  onChange={e => setForm(f => ({ ...f, armour_landed_cost: Number(e.target.value) }))}
                  className="flex-1"
                />
                {liveP?.gi_wire_rs_kg != null && (
                  <button
                    type="button"
                    title={`Use live GI wire price: ₹${Math.round(liveP.gi_wire_rs_kg)}/kg`}
                    onClick={() => setForm(f => ({ ...f, armour_landed_cost: Math.round(liveP.gi_wire_rs_kg) }))}
                    className="shrink-0 text-xs bg-emerald-500 hover:bg-emerald-600 text-white px-2 py-2 rounded-lg transition-colors"
                  >
                    ₹{Math.round(liveP.gi_wire_rs_kg)}↙
                  </button>
                )}
              </div>
            </div>
            <Field label="Packing Factor" hint="Fraction of circumference covered">
              <FInput type="number" step="0.01" min="0.7" max="1.0" value={form.arm_packing}
                onChange={e => setForm(f => ({ ...f, arm_packing: Number(e.target.value) }))} />
            </Field>
            <div className="bg-gray-50 rounded-lg p-3 space-y-0.5">
              <CalcRow label="Armour wire dia"    value={result?.arm_d != null ? fmt(result.arm_d, 2) : '—'} unit="mm" />
              <CalcRow label="No. of wires"       value={result?.n_armour_wires ?? '—'} />
              <CalcRow label="Armour wt/km"       value={fmt(result?.wt_armour_per_km)} unit="kg/km" highlight />
              <CalcRow label="Dia over armour"    value={fmt(result?.dia_over_armour)}  unit="mm" />
            </div>
          </>
        )}
      </div>
      )} {/* end IS_694 conditional */}

      {/* ── Braid Shield — BN 50288 P7 instrumentation cables ── */}
      {form.standard === 'BN_50288_P7' && (
        <>
          <SectionHeader>Braid Shield</SectionHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={form.has_braid}
                  onChange={e => setForm(f => ({ ...f, has_braid: e.target.checked }))}
                  className="w-4 h-4 rounded accent-brand-500" />
                <span className="text-sm font-medium text-gray-700">Apply copper braid shield</span>
                <span className="text-xs text-gray-400">(per BN 50288 P7 braid table)</span>
              </label>
            </div>
            {form.has_braid && (
              <>
                <Field label="No. of Carriers">
                  <FSelect value={form.braid_n_carriers}
                    onChange={e => setForm(f => ({ ...f, braid_n_carriers: Number(e.target.value) }))}>
                    {[4, 6, 8, 12, 16, 24].map(n => <option key={n} value={n}>{n}</option>)}
                  </FSelect>
                </Field>
                <Field label="Wires per Carrier">
                  <FSelect value={form.braid_n_wires}
                    onChange={e => setForm(f => ({ ...f, braid_n_wires: Number(e.target.value) }))}>
                    {[4, 6, 8, 10, 12].map(n => <option key={n} value={n}>{n}</option>)}
                  </FSelect>
                </Field>
                <Field label="Braid Angle (°)" hint="Typically 35–45°">
                  <FInput type="number" step="1" min="25" max="60" value={form.braid_angle}
                    onChange={e => setForm(f => ({ ...f, braid_angle: Number(e.target.value) }))} />
                </Field>
                <Field label="Wire Density (g/cm³)" hint="Copper = 8.9, Al = 2.7">
                  <FInput type="number" step="0.01" value={form.braid_density}
                    onChange={e => setForm(f => ({ ...f, braid_density: Number(e.target.value) }))} />
                </Field>
                <Field label="Landed Cost (₹/kg)">
                  <FInput type="number" step="0.01" value={form.braid_landed_cost}
                    onChange={e => setForm(f => ({ ...f, braid_landed_cost: Number(e.target.value) }))} />
                </Field>
                <div className="bg-gray-50 rounded-lg p-3 space-y-0.5">
                  <CalcRow label="Wire diameter"   value={result?.braid_wire_d != null ? result.braid_wire_d.toFixed(3) : '—'} unit="mm" />
                  <CalcRow label="Coverage"        value={result?.braid_coverage_pct ?? '—'} unit="%" highlight />
                  <CalcRow label="Dia over braid"  value={result?.dia_over_braid != null ? result.dia_over_braid.toFixed(2) : '—'} unit="mm" />
                  <CalcRow label="Braid wt/km"     value={result?.wt_braid_per_km != null ? Math.round(result.wt_braid_per_km) : '—'} unit="kg/km" highlight />
                </div>
              </>
            )}
          </div>
        </>
      )}

      <SectionHeader>Outer Sheath</SectionHeader>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <MaterialCombobox
            label="Outer Sheath Material *"
            materials={sheathMats}
            value={form.outer_sheath_material_name}
            onSelect={handleSheathSelect}
            placeholder="Search PVC compound, HDPE..."
          />
        </div>
        <Field label="Extrusion Type">
          <FSelect value={form.outer_sheath_extrusion}
            onChange={e => setForm(f => ({ ...f, outer_sheath_extrusion: e.target.value }))}>
            <option value="tube">Tube</option>
            <option value="pressure">Pressure</option>
          </FSelect>
        </Field>
        <Field label="Pressure Fill Factor (auto)" hint="Based on n_cores & extrusion type">
          <FInput type="text" value={fmt(pfFactor, 3)} disabled />
        </Field>
        <Field label="Thickness Nom (mm)">
          <div className="relative">
            <FInput
              type="number" step="0.1" min="0.1"
              value={form.t_outer_sheath ?? ''}
              placeholder="auto from standard"
              onChange={e => setForm(f => ({ ...f, t_outer_sheath: Number(e.target.value) || null, t_outer_sheath_custom: true }))}
              className={form.t_outer_sheath_custom ? 'border-yellow-400' : ''}
            />
            {form.t_outer_sheath_custom && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                <AlertTriangle size={14} className="text-yellow-500" />
              </span>
            )}
          </div>
        </Field>
        <Field label="Min Thickness (mm) — nom × 0.8">
          <FInput type="text" value={form.t_outer_sheath ? fmt(form.t_outer_sheath * 0.8) : '—'} disabled />
        </Field>
        <Field label="Sheath Color">
          <FInput value={form.outer_sheath_color}
            onChange={e => setForm(f => ({ ...f, outer_sheath_color: e.target.value }))} />
        </Field>
        <Field label="Outer Sheath Wastage (%)">
          <FInput type="number" step="0.1" min="0" value={form.outer_sheath_wastage}
            onChange={e => setForm(f => ({ ...f, outer_sheath_wastage: Number(e.target.value) }))} />
        </Field>
        <Field label="Landed Cost (₹/kg)">
          <FInput type="number" step="0.01" value={form.outer_sheath_landed_cost}
            onChange={e => setForm(f => ({ ...f, outer_sheath_landed_cost: Number(e.target.value) }))} />
        </Field>
      </div>

      <SectionHeader>Live Calculations</SectionHeader>
      <div className="bg-gray-50 rounded-lg p-3 space-y-0.5">
        <CalcRow label="Overall Cable OD"     value={fmt(result?.overall_dia)}              unit="mm"    highlight />
        <CalcRow label="Outer Sheath Wt/km"   value={fmt(result?.wt_outer_sheath_per_km)}  unit="kg/km" />
        <CalcRow label="Total Cable Wt/km"    value={fmt(result?.wt_total_per_km)}          unit="kg/km" highlight />
      </div>
    </div>
  )
}

// ─── STEP 7 ───────────────────────────────────────────────────────────────────

function Step7({ form, setForm, result }) {
  const drum      = result?.drum_label ? { label: result.drum_label, price: result.drum_cost_each } : null
  const n_drums   = result?.n_drums        ?? 0
  const totalCost = result?.cost_drums_total ?? 0
  const costPerM  = result?.cost_packaging_per_m ?? 0

  return (
    <div className="space-y-4">
      <SectionHeader>Packing Configuration</SectionHeader>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Packing Length per Drum">
          <FSelect value={form.packing_length_m}
            onChange={e => setForm(f => ({ ...f, packing_length_m: Number(e.target.value) }))}>
            {PACKING_OPTIONS.map(p => <option key={p} value={p}>{p}m</option>)}
          </FSelect>
        </Field>
        <Field label="Drum Material">
          <FSelect value={form.drum_material}
            onChange={e => setForm(f => ({ ...f, drum_material: e.target.value }))}>
            <option value="wood">Wood</option>
            <option value="metal">Metal / Steel</option>
            <option value="plywood">Plywood</option>
          </FSelect>
        </Field>
      </div>

      <SectionHeader>Packing Summary</SectionHeader>
      <div className="bg-gray-50 rounded-xl p-4 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Drum Size (auto-selected)</span>
          <span className="font-mono font-semibold text-gray-700">{drum?.label ?? '—'}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Cost per Drum</span>
          <span className="font-semibold text-gray-700">{fmtCost(drum?.price)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Number of Drums</span>
          <span className="font-semibold text-gray-700">{n_drums}</span>
        </div>
        <div className="border-t border-gray-200 pt-2 flex justify-between text-sm">
          <span className="text-gray-500">Total Packing Cost</span>
          <span className="font-bold text-brand-700">{fmtCost(totalCost)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Packing Cost per meter</span>
          <span className="font-semibold text-brand-700">{fmtCost(costPerM)}/m</span>
        </div>
      </div>
    </div>
  )
}

// ─── STEP 8 ───────────────────────────────────────────────────────────────────

function Step8({ form, setForm, result, onSave, onPrint, saving, designation }) {
  if (!result) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-400">
        <DollarSign size={40} className="mb-3 opacity-40" />
        <p className="text-sm">Complete previous steps to see the quote summary.</p>
      </div>
    )
  }

  const weightRows = [
    { label: 'Conductor',    wt: result.wt_conductor_per_km,    cost: result.cost_conductor_material    },
    { label: 'Insulation',   wt: result.wt_insul_per_km,        cost: result.cost_insul_material        },
    result.wt_filler_per_km  > 0 && { label: 'Filler',    wt: result.wt_filler_per_km,  cost: result.cost_filler  },
    result.wt_binder_per_km  > 0 && { label: 'Binder',    wt: result.wt_binder_per_km,  cost: result.cost_binder  },
    result.wt_binding_per_km > 0 && { label: 'Binding Tape', wt: result.wt_binding_per_km, cost: result.cost_binding },
    result.wt_inner_sheath_per_km > 0 && { label: 'Inner Sheath', wt: result.wt_inner_sheath_per_km, cost: result.cost_inner_sheath },
    result.wt_armour_per_km  > 0 && { label: 'Armour',    wt: result.wt_armour_per_km,  cost: result.cost_armour  },
    result.wt_outer_sheath_per_km > 0 && { label: 'Outer Sheath', wt: result.wt_outer_sheath_per_km, cost: result.cost_outer_sheath_material },
    { label: 'TOTAL',        wt: result.wt_total_per_km,        cost: result.total_material_cost, bold: true },
  ].filter(Boolean)

  return (
    <div className="space-y-6">
      <SectionHeader>Margin &amp; Notes</SectionHeader>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Profit Margin (%)">
          <FInput type="number" step="0.5" min="0" value={form.profit_margin_pct}
            onChange={e => setForm(f => ({ ...f, profit_margin_pct: Number(e.target.value) }))} />
        </Field>
        <div />
        <div className="sm:col-span-2">
          <Field label="Notes / Remarks">
            <textarea
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 resize-none"
              rows={3}
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Any special conditions, delivery terms, etc."
            />
          </Field>
        </div>
      </div>

      <SectionHeader>Weight Breakdown (kg/km)</SectionHeader>
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">Component</th>
              <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500">Weight (kg/km)</th>
              <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500">Material Cost (₹)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {weightRows.map(row => (
              <tr key={row.label} className={row.bold ? 'bg-brand-50' : ''}>
                <td className={`px-4 py-2 ${row.bold ? 'text-brand-700 font-bold' : 'text-gray-700'}`}>{row.label}</td>
                <td className={`px-4 py-2 text-right ${row.bold ? 'text-brand-700 font-bold' : 'text-gray-600'}`}>{fmt(row.wt)}</td>
                <td className={`px-4 py-2 text-right ${row.bold ? 'text-brand-700 font-bold' : 'text-gray-600'}`}>{fmtCost(row.cost)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <SectionHeader>Cost Breakdown</SectionHeader>
      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-500">Total Material Cost</span>
          <span className="font-semibold text-gray-700">{fmtCost(result.total_material_cost)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Total Operating Cost</span>
          <span className="font-semibold text-gray-700">{fmtCost(result.total_op_cost)}</span>
        </div>
        <div className="flex justify-between border-t border-gray-100 pt-2">
          <span className="text-gray-600 font-medium">Total Mfg Cost</span>
          <span className="font-bold text-gray-800">{fmtCost(result.total_mfg_cost)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Profit ({form.profit_margin_pct}%)</span>
          <span className="font-semibold text-green-600">{fmtCost(result.profit_amount)}</span>
        </div>
        <div className="flex justify-between border-t border-gray-200 pt-2">
          <span className="text-brand-700 font-bold">Quote Total</span>
          <span className="font-bold text-brand-700 text-base">{fmtCost(result.quote_total)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Quote per km</span>
          <span className="font-semibold text-brand-700">{fmtCost(result.quote_per_km)}/km</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Quote per meter (incl. packing)</span>
          <span className="font-bold text-brand-700">{fmtCost(result.quote_per_m_with_packing)}/m</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 pt-2">
        <button
          onClick={() => onSave('draft')}
          disabled={saving}
          className="flex items-center gap-2 bg-brand-500 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-brand-600 disabled:opacity-50 transition-colors"
        >
          <Save size={16} />
          {saving ? 'Saving...' : 'Save Quotation'}
        </button>
        <button
          onClick={() => onSave('production')}
          disabled={saving}
          className="flex items-center gap-2 bg-green-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
        >
          <FileText size={16} />
          Send to Production
        </button>
        <button
          onClick={onPrint}
          className="flex items-center gap-2 bg-gray-700 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
        >
          <Printer size={16} />
          Print / PDF
        </button>
      </div>
    </div>
  )
}

// ─── PRINT QUOTATION ─────────────────────────────────────────────────────────

function printQuotation(form, result, designation) {
  let ds
  try { ds = generateDatasheet(form, result) } catch { ds = {} }

  const date   = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  const qNo    = `Q${new Date().toISOString().slice(0,10).replace(/-/g,'')}${Date.now().toString().slice(-4)}`
  const n      = (v, d=2) => v != null && !isNaN(v) ? Number(v).toFixed(d) : '—'
  const c      = (v) => v != null && !isNaN(v) ? '₹' + Number(v).toLocaleString('en-IN', { minimumFractionDigits:2, maximumFractionDigits:2 }) : '—'
  const stdLbl = STANDARDS.find(s => s.value === form.standard)?.label ?? form.standard
  const nCStr  = form.n_cores === 3.5 ? '3½' : String(form.n_cores)

  // Technical specification rows
  const techRows = [
    ['Conductor', `${form.n_strands}-strand ${form.conductor_material_name || 'Copper'}, Class ${(form.conductor_class ?? '').replace('class','').toUpperCase()}, ${form.conductor_shape ?? 'round'}`],
    ['Conductor OD', `${n(result.conductor_od, 3)} mm  (strand dia: ${n(result.strand_dia, 4)} mm)`],
    ['Insulation', `${form.insul_material_name || 'XLPE'}, nom. ${n(form.t_insul, 1)} mm (min. ${n(form.t_insul * 0.8, 2)} mm)`],
    ['Dia over Insulation', `${n(result.dia_over_insul, 3)} mm`],
    form.n_cores > 1 && ['Laid-up OD', `${n(result.dia_over_laidup, 3)} mm`],
    result.t_inner_sheath > 0 && ['Inner Sheath', `${form.inner_sheath_material_name || 'PVC'}, nom. ${n(result.t_inner_sheath, 2)} mm`],
    result.wt_armour_per_km > 0 && ['Armour', `${form.armour_type === 'wire' ? 'GI Round Wire' : 'MS Strip'}, wire ø${n(result.arm_d, 2)} mm × ${result.n_armour_wires} wires`],
    result.t_outer_sheath > 0 && ['Outer Sheath', `${form.outer_sheath_material_name || 'PVC'}, nom. ${n(result.t_outer_sheath, 2)} mm (min. ${n(result.t_outer_sheath * 0.8, 2)} mm), ${form.outer_sheath_color}`],
    ['Overall OD', `${n(result.overall_dia, 2)} mm`],
    ['Approx. Weight', `${n(result.wt_total_per_km, 1)} kg/km`],
    ['DC Resistance', `≤ ${form.R_max} Ω/km at 20°C (IS 8130)`],
    ['Packing', `${result.n_drums} drum${result.n_drums !== 1 ? 's' : ''} × ${form.packing_length_m} m on ${result.drum_label || '—'} (${form.drum_material})`],
  ].filter(Boolean)

  // Material cost rows
  const matRows = [
    form.conductor_material_name && { label: 'Conductor', mat: form.conductor_material_name, wt: result.wt_conductor_per_km, rate: form.conductor_landed_cost, total: result.cost_conductor_material },
    form.insul_material_name     && { label: 'Insulation', mat: form.insul_material_name, wt: result.wt_insul_per_km, rate: form.insul_landed_cost, total: result.cost_insul_material },
    (result.wt_filler_per_km > 0 || result.wt_binder_per_km > 0) && { label: 'Filler / Binder', mat: form.filler_type !== 'none' ? form.filler_type : form.binder_type, wt: (result.wt_filler_per_km||0) + (result.wt_binder_per_km||0), rate: null, total: (result.cost_filler||0) + (result.cost_binder||0) },
    result.wt_binding_per_km > 0 && { label: 'Binding Tape', mat: form.binding_tape_name, wt: result.wt_binding_per_km, rate: form.binding_tape_landed_cost, total: result.cost_binding },
    result.wt_inner_sheath_per_km > 0 && { label: 'Inner Sheath', mat: form.inner_sheath_material_name, wt: result.wt_inner_sheath_per_km, rate: form.inner_sheath_landed_cost, total: result.cost_inner_sheath },
    result.wt_armour_per_km > 0 && { label: 'Armour', mat: form.armour_material_name || 'GI Wire', wt: result.wt_armour_per_km, rate: form.armour_landed_cost, total: result.cost_armour },
    result.wt_outer_sheath_per_km > 0 && { label: 'Outer Sheath', mat: form.outer_sheath_material_name, wt: result.wt_outer_sheath_per_km, rate: form.outer_sheath_landed_cost, total: result.cost_outer_sheath_material },
  ].filter(Boolean)

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Cable Quotation — ${qNo}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:Arial,Helvetica,sans-serif;font-size:9.5pt;color:#111;background:#fff}
  .page{max-width:210mm;margin:0 auto;padding:11mm 13mm}
  .header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2.5px solid #1e3a5f;padding-bottom:9px;margin-bottom:9px}
  .co-name{font-size:17pt;font-weight:800;color:#1e3a5f;letter-spacing:-.5px}
  .co-sub{font-size:7.5pt;color:#666;margin-top:2px;text-transform:uppercase;letter-spacing:.5px}
  .co-addr{font-size:7pt;color:#777;margin-top:5px;line-height:1.6}
  .doc-right{text-align:right}
  .doc-right h2{font-size:13pt;font-weight:700;color:#1e3a5f;text-transform:uppercase;letter-spacing:1px}
  .doc-meta{font-size:8pt;color:#444;margin-top:5px;line-height:1.7}
  .info-bar{display:grid;grid-template-columns:1fr 1fr;gap:3px 20px;background:#eef2f7;padding:7px 10px;border-radius:4px;margin-bottom:9px;font-size:8pt}
  .ib-row{display:flex;gap:6px}
  .ib-k{color:#555;min-width:80px;font-weight:600}
  .ib-v{color:#111;font-weight:700}
  .desig-box{background:#1e3a5f;color:#fff;padding:8px 12px;border-radius:4px;margin-bottom:9px;display:flex;justify-content:space-between;align-items:center}
  .desig-label{font-size:6.5pt;color:#99b;text-transform:uppercase;letter-spacing:.5px;margin-bottom:2px}
  .desig-value{font-family:'Courier New',monospace;font-size:14pt;font-weight:700;letter-spacing:1px}
  .desig-right{text-align:right;font-size:8pt;color:#cce;line-height:1.7}
  .sec{font-size:8.5pt;font-weight:700;color:#1e3a5f;text-transform:uppercase;letter-spacing:.5px;border-bottom:1.5px solid #1e3a5f;padding-bottom:3px;margin:9px 0 5px}
  .tech-grid{display:grid;grid-template-columns:140px 1fr 140px 1fr;gap:0;border:1px solid #d0d8e0;border-radius:4px;overflow:hidden;font-size:8pt}
  .tk{padding:4px 8px;background:#f0f4f8;font-weight:600;color:#444;border-bottom:1px solid #e0e8f0}
  .tv{padding:4px 8px;background:#fff;color:#111;border-bottom:1px solid #e0e8f0;border-left:1px solid #e0e8f0}
  table{width:100%;border-collapse:collapse;font-size:8.5pt}
  th{background:#1e3a5f;color:#fff;text-align:left;padding:5px 7px;font-weight:600;font-size:7.5pt}
  th.r,td.r{text-align:right}
  td{padding:4px 7px;border-bottom:1px solid #eaeff4}
  tr.alt td{background:#f8fafc}
  tr.tot td{background:#eef2f7;font-weight:700;border-top:2px solid #1e3a5f}
  .price-box{background:#1e3a5f;color:#fff;padding:10px 13px;border-radius:4px}
  .pr{display:flex;justify-content:space-between;font-size:8.5pt;margin-bottom:3px}
  .pr.big{font-size:11pt;font-weight:700;border-top:1px solid rgba(255,255,255,.25);padding-top:6px;margin-top:5px}
  .pr.sm{color:#aac;font-size:7.5pt}
  .terms{font-size:7.5pt;color:#555;padding-left:13px}
  .terms li{margin-bottom:2px}
  .footer{display:flex;justify-content:space-between;align-items:flex-end;margin-top:14px;padding-top:10px;border-top:1px solid #ccc;font-size:7.5pt;color:#777}
  .sig-line{border-top:1px solid #888;width:130px;margin:32px 0 4px}
  @media print{
    body{-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .page{padding:7mm 10mm}
  }
</style>
</head>
<body>
<div class="page">

<div class="header">
  <div>
    <div class="co-name">CHHAPERIA CABLE MATERIAL PVT. LTD.</div>
    <div class="co-sub">Cable Manufacturer &nbsp;·&nbsp; IS / BIS Certified</div>
    <div class="co-addr">
      23/18/1, Bisuvanahalli Village, Doddaballapur, Bengaluru Rural, Karnataka — 561203<br>
      GSTIN: 29AAICC5462H1ZE &nbsp;·&nbsp; cables@micagroup.net &nbsp;·&nbsp; +91 8073533289
    </div>
  </div>
  <div class="doc-right">
    <h2>Cable Quotation</h2>
    <div class="doc-meta">
      <b>Ref No:</b> ${qNo}<br>
      <b>Date:</b> ${date}<br>
      <b>Valid:</b> 30 days from date of issue
    </div>
  </div>
</div>

<div class="info-bar">
  <div class="ib-row"><span class="ib-k">Customer:</span><span class="ib-v">${form.customer_name || '—'}</span></div>
  <div class="ib-row"><span class="ib-k">Standard:</span><span class="ib-v">${stdLbl}</span></div>
  <div class="ib-row"><span class="ib-k">Project:</span><span class="ib-v">${form.project_name || '—'}</span></div>
  <div class="ib-row"><span class="ib-k">Quantity:</span><span class="ib-v">${form.order_km} km &nbsp;(${result.n_drums} drum${result.n_drums!==1?'s':''} × ${form.packing_length_m} m)</span></div>
</div>

<div class="desig-box">
  <div>
    <div class="desig-label">Cable Designation</div>
    <div class="desig-value">${designation || '—'}</div>
  </div>
  <div class="desig-right">
    ${nCStr} Core${form.n_cores!==1?'s':''} × ${form.conductor_size} mm²<br>
    ${form.standard==='IS_694'?'450/750V':'1.1kV'} &nbsp;·&nbsp; ${form.conductor_material_name || 'Copper'}
  </div>
</div>

<div class="sec">Technical Specifications</div>
<div class="tech-grid">
  ${techRows.map(([k,v]) => `<div class="tk">${k}</div><div class="tv">${v}</div>`).join('')}
</div>

<div class="sec">Material Weight &amp; Cost Breakdown</div>
<table>
  <thead>
    <tr>
      <th>Component</th><th>Material</th>
      <th class="r">Wt (kg/km)</th><th class="r">Rate (₹/kg)</th>
      <th class="r">Total Wt (kg)</th><th class="r">Total Cost (₹)</th>
    </tr>
  </thead>
  <tbody>
    ${matRows.map((row,i)=>`
    <tr${i%2===1?' class="alt"':''}>
      <td><b>${row.label}</b></td>
      <td>${row.mat||'—'}</td>
      <td class="r">${n(row.wt)}</td>
      <td class="r">${row.rate!=null&&row.rate>0?'₹'+n(row.rate,2):'—'}</td>
      <td class="r">${n(row.wt*(form.order_km||1),1)}</td>
      <td class="r">${c(row.total)}</td>
    </tr>`).join('')}
    <tr class="tot">
      <td colspan="2">TOTAL</td>
      <td class="r">${n(result.wt_total_per_km)}</td><td class="r">—</td>
      <td class="r">${n(result.wt_total_per_km*(form.order_km||1),1)}</td>
      <td class="r">${c(result.total_material_cost)}</td>
    </tr>
  </tbody>
</table>

<div class="sec">Pricing Summary</div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;align-items:start">
  <table>
    <thead><tr><th>Cost Element</th><th class="r">Amount (₹)</th></tr></thead>
    <tbody>
      <tr><td>Total Material Cost</td><td class="r">${c(result.total_material_cost)}</td></tr>
      <tr class="alt"><td>Operating Cost</td><td class="r">${c(result.total_op_cost)}</td></tr>
      <tr><td>Packing (${result.n_drums} drums)</td><td class="r">${c(result.cost_drums_total)}</td></tr>
      <tr class="alt tot"><td>Manufacturing Cost</td><td class="r">${c(result.total_mfg_cost)}</td></tr>
      <tr><td>Profit @ ${form.profit_margin_pct}%</td><td class="r" style="color:#2a7">${c(result.profit_amount)}</td></tr>
    </tbody>
  </table>
  <div class="price-box">
    <div class="pr sm"><span>Order: ${form.order_km} km &nbsp;·&nbsp; ${result.n_drums} drums</span></div>
    <div class="pr big"><span>QUOTE TOTAL</span><span>${c(result.quote_total)}</span></div>
    <div class="pr" style="margin-top:8px"><span>Per km</span><span>${c(result.quote_per_km)} / km</span></div>
    <div class="pr"><span>Per meter (incl. packing)</span><span style="font-size:11pt;font-weight:700">${c(result.quote_per_m_with_packing)} / m</span></div>
    <div class="pr sm" style="margin-top:6px"><span>* GST 18% extra as applicable</span></div>
  </div>
</div>

${form.notes ? `
<div class="sec">Notes / Special Conditions</div>
<div style="font-size:8pt;padding:6px 9px;background:#fffbeb;border:1px solid #e8c84a;border-radius:4px">${form.notes}</div>
` : ''}

<div class="sec">Terms &amp; Conditions</div>
<ul class="terms">
  <li>All prices are exclusive of GST (18% CGST+SGST / IGST), which will be charged additionally as applicable.</li>
  <li>Prices are ex-works Bisuvanahalli, Doddaballapur. Freight, insurance &amp; loading charges are extra.</li>
  <li>This quotation is valid for 30 days from the date of issue, subject to raw material price stability.</li>
  <li>Delivery: 4–6 weeks from receipt of confirmed purchase order and agreed advance payment.</li>
  <li>Payment: 50% advance with PO, balance against pro-forma invoice before dispatch.</li>
  <li>Cables will be manufactured &amp; tested as per the applicable Indian Standard / BN Standard; test reports provided.</li>
  <li>Prices are subject to revision in case of significant movement in copper / aluminium / GI wire market prices.</li>
</ul>

<div class="footer">
  <div>
    Generated by Indocable ERP &nbsp;·&nbsp; cables@micagroup.net &nbsp;·&nbsp; +91 8073533289
  </div>
  <div style="text-align:center">
    <div class="sig-line"></div>
    <div style="font-weight:700;color:#1e3a5f;font-size:8.5pt">Authorised Signatory</div>
    <div>For Chhaperia Cable Material Pvt. Ltd.</div>
  </div>
</div>

</div>
</body>
</html>`

  const w = window.open('', '_blank', 'width=900,height=750')
  if (!w) { toast.error('Allow pop-ups for this site to enable print preview.'); return }
  w.document.write(html)
  w.document.close()
  w.focus()
  setTimeout(() => w.print(), 600)
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

export default function NewQuotation({ profile }) {
  const navigate = useNavigate()

  const [step, setStep]             = useState(1)
  const [maxReached, setMaxReached] = useState(1)
  const [form, setForm]             = useState(INITIAL_FORM)
  const [bomMaterials, setBomMaterials] = useState([])
  const [bomLoading, setBomLoading] = useState(true)
  const [result, setResult]         = useState(null)
  const [calcError, setCalcError]   = useState(null)
  const [designation, setDesignation] = useState('')
  const [saving, setSaving]         = useState(false)

  // ── Load BOM on mount ──────────────────────────────────────────────────────
  useEffect(() => {
    async function loadBom() {
      const { data, error } = await supabase.from('bom_materials').select('*').order('name')
      if (error) toast.error('Failed to load BOM materials: ' + error.message)
      // Compute landed_cost client-side (base_price + freight)
      const withLanded = (data || []).map(m => ({
        ...m,
        landed_cost: (m.base_price ?? 0) + (m.freight ?? 0),
      }))
      setBomMaterials(withLanded)
      setBomLoading(false)
    }
    loadBom()
  }, [])

  // ── Auto-update insulation + sheath thickness on config change ───────────
  useEffect(() => {
    const opts = {
      insulation_subtype: form.insulation_subtype,
      voltage_class: form.voltage_class,
    }
    const thk = getStandardThicknesses(
      form.standard, form.category, form.conductor_size, form.n_cores, form.conductor_class, opts,
    )
    const updates = { color_code_custom: null }
    if (!form.t_insul_custom && thk?.insul_t)  updates.t_insul = thk.insul_t
    if (!form.t_outer_sheath_custom) {
      if (thk?.sheath_t) {
        updates.t_outer_sheath = thk.sheath_t
      } else if (thk && !thk.has_sheath) {
        updates.t_outer_sheath = null
      }
    }
    setForm(f => ({ ...f, ...updates }))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.standard, form.category, form.conductor_size, form.n_cores, form.conductor_class,
      form.insulation_subtype, form.voltage_class])

  // ── Auto-update R_max when size / material / class changes ─────────────────
  useEffect(() => {
    if (!form.conductor_material_name) return
    const dcr = getDcResistance(form.conductor_size, form.conductor_material_name, getDcrClass(form.conductor_class))
    if (dcr != null) setForm(f => ({ ...f, R_max: dcr }))
  }, [form.conductor_size, form.conductor_material_name, form.conductor_class])

  // ── Run calculation whenever form changes ──────────────────────────────────
  useEffect(() => {
    try {
      const r = calcQuotation(form)
      setResult(r)
      setCalcError(null)
      try { setDesignation(buildDesignation(form)) } catch { setDesignation('') }
    } catch (err) {
      setCalcError(err.message || 'Calculation error')
      setResult(null)
    }
  }, [form])

  // ── Navigation ─────────────────────────────────────────────────────────────
  function goToStep(n) {
    setStep(n)
    setMaxReached(m => Math.max(m, n))
  }
  function handleNext() { if (step < 8) goToStep(step + 1) }
  function handleBack() { if (step > 1) setStep(s => s - 1) }

  // ── Save ───────────────────────────────────────────────────────────────────
  async function handleSave(status = 'draft') {
    if (!result) { toast.error('Fix calculation errors before saving.'); return }

    // For production only: require material costs so the quote is complete
    if (status === 'production') {
      if (!form.conductor_material_name || !(form.conductor_landed_cost > 0)) {
        toast.error('Step 2: Select a conductor material with a non-zero price before sending to production.')
        return
      }
      if (!form.insul_material_name || !(form.insul_landed_cost > 0)) {
        toast.error('Step 3: Select an insulation material with a non-zero price before sending to production.')
        return
      }
    }

    // Soft warnings for draft (don't block)
    if (status === 'draft') {
      if (!form.conductor_material_name) toast('Tip: set a conductor material in Step 2 for accurate costing.', { icon: '⚠️' })
      else if (!form.insul_material_name) toast('Tip: set an insulation material in Step 3 for accurate costing.', { icon: '⚠️' })
    }

    setSaving(true)
    try {
      let datasheet = null
      try { datasheet = generateDatasheet(form, result) } catch { /* ignore */ }

      const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
      const quotation_no = `Q${date}${Date.now().toString().slice(-4)}`

      const { error } = await supabase.from('quotations').insert([{
        created_by:        profile.id,
        quotation_no,
        customer:          form.customer_name || null,
        standard:          form.standard,
        designation,
        cable_designation: designation,
        status,
        form_snapshot:     { ...form, datasheet },
        result_snapshot:   result,
      }])

      if (error) throw error
      toast.success(status === 'production' ? 'Sent to Production!' : 'Quotation saved!')
      navigate('/quotations')
    } catch (err) {
      toast.error('Save failed: ' + (err.message || 'Unknown error'))
    } finally {
      setSaving(false)
    }
  }

  // ── Loading state ─────────────────────────────────────────────────────────
  if (bomLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-500" />
        <span className="ml-3 text-gray-500 text-sm">Loading BOM materials...</span>
      </div>
    )
  }

  const StepIcon = STEP_ICONS[step - 1]

  return (
    <div className="min-h-screen bg-gray-50 -mx-4 sm:-mx-6 lg:-mx-8 -my-6">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3 flex items-center gap-3">
        <button
          onClick={() => navigate('/quotations')}
          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-lg font-bold text-gray-900">New Cable Quotation</h1>
          <p className="text-xs text-gray-400">
            Step {step} of 8 &mdash; {STEP_TITLES[step - 1]}
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3">
        <StepBar step={step} maxReached={maxReached} onStep={goToStep} />
      </div>

      {/* Body */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex flex-col lg:flex-row gap-6">

        {/* Left: form card */}
        <div className="flex-1 min-w-0">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 md:p-6">
            {/* Step title */}
            <div className="flex items-center gap-2 mb-5">
              <div className="w-8 h-8 bg-brand-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <StepIcon size={16} className="text-brand-600" />
              </div>
              <h2 className="text-base font-bold text-gray-900">{STEP_TITLES[step - 1]}</h2>
            </div>

            {step === 1 && <Step1 form={form} setForm={setForm} />}
            {step === 2 && <Step2 form={form} setForm={setForm} bomMaterials={bomMaterials} result={result} />}
            {step === 3 && <Step3 form={form} setForm={setForm} bomMaterials={bomMaterials} result={result} />}
            {step === 4 && <Step4 form={form} setForm={setForm} bomMaterials={bomMaterials} result={result} />}
            {step === 5 && <Step5 form={form} setForm={setForm} bomMaterials={bomMaterials} result={result} />}
            {step === 6 && <Step6 form={form} setForm={setForm} bomMaterials={bomMaterials} result={result} />}
            {step === 7 && <Step7 form={form} setForm={setForm} result={result} />}
            {step === 8 && (
              <Step8
                form={form}
                setForm={setForm}
                result={result}
                onSave={handleSave}
                onPrint={() => printQuotation(form, result, designation)}
                saving={saving}
                designation={designation}
              />
            )}

            {/* Bottom navigation */}
            <div className="flex items-center justify-between mt-8 pt-5 border-t border-gray-100">
              <button
                onClick={handleBack}
                disabled={step === 1}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ArrowLeft size={15} /> Back
              </button>

              {step < 8 ? (
                <button
                  onClick={handleNext}
                  className="flex items-center gap-2 px-5 py-2 text-sm font-medium bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors"
                >
                  Next <ArrowRight size={15} />
                </button>
              ) : (
                <button
                  onClick={() => handleSave('draft')}
                  disabled={saving}
                  className="flex items-center gap-2 px-5 py-2 text-sm font-medium bg-brand-500 text-white rounded-lg hover:bg-brand-600 disabled:opacity-50 transition-colors"
                >
                  <Save size={15} /> {saving ? 'Saving...' : 'Save Quotation'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right: live result panel */}
        <div className="lg:w-72 xl:w-80 flex-shrink-0">
          <ResultPanel
            form={form}
            result={result}
            calcError={calcError}
            designation={designation}
          />
        </div>
      </div>
    </div>
  )
}

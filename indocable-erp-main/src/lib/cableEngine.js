/**
 * Indocable ERP — Cable Quotation Engine
 * All formulas verified against IS 694 Excel Master Sheet.
 *
 * Physics reference:
 *  - Strand dia:    d = sqrt(4·ρ·K_cond·K_core / (π·R_max·n·ff))
 *  - Insul weight:  π·(d_c + t)·t·ρ_i  per km per core
 *  - Sheath weight: π·(d_u + t)·t·ρ_s · pressure_factor  per km
 *  - Tape weight:   surface_density · width · length_per_m · n_layers / (1-overlap)
 */

import {
  DC_RESISTANCE,
  CONDUCTOR_FILL_FACTOR,
  ASSEMBLY_FACTOR,
  getLaidupFactor,
  INNER_SHEATH_THICKNESS,
  getInnerSheathThickness,
  getArmourDims,
  getOsSheathThickness,
  getPressureFillFactor,
  getColorCode,
  IS694_T1_SINGLE_CORE_UNSHEATHED,
  IS694_T2_RIGID_SHEATHED,
  IS694_T3_FLEX_SHEATHED,
  IS694_T3B_MULTICORE_FLEX,
  IS694_T3B_SIZES,
  IS694_T4_FLAT,
  IS694_T5_TWIN_PARALLEL,
  IS7098P1_INSUL,
  IS1554P1_INSUL,
  IS17505P1_INSUL,
  BN50288_INSUL,
  BN50288_BRAID,
  NEUTRAL_CONDUCTOR,
  lookupStep,
  selectDrum,
} from './standardsTables'

const PI = Math.PI

// ─── K_LAY CALCULATION ────────────────────────────────────────────────────────

/** K_lay for a helically stranded layer: sqrt(1 + (π/lay_factor)²)
 *  lay_factor = lay_length / diameter
 *  For solid conductors (1 strand) → K_lay = 1.0
 */
export function calcKLay(lay_factor, n_strands) {
  if (!lay_factor || n_strands <= 1) return 1.0
  return Math.sqrt(1 + (PI / lay_factor) ** 2)
}

// ─── CONDUCTOR CALCULATION ────────────────────────────────────────────────────

/**
 * Calculate strand diameter from max DC resistance spec.
 * d = sqrt(4·ρ_km·K_cond·K_core / (π·R_max·n_strands·fill_factor))
 *
 * @param {number} rho_km  - Resistivity Ω·mm²/km (= resistivity_Ω·mm²/m × 1000)
 * @param {number} K_cond  - K_lay of conductor strands
 * @param {number} K_core  - K_lay of core within cable
 * @param {number} R_max   - Max DC resistance Ω/km at 20°C (from IS 8130)
 * @param {number} n       - Number of strands
 * @param {number} ff      - Conductor fill factor
 * @returns {number} strand diameter in mm
 */
export function calcStrandDia(rho_km, K_cond, K_core, R_max, n, ff) {
  return Math.sqrt((4 * rho_km * K_cond * K_core) / (PI * R_max * n * ff))
}

/**
 * Conductor OD from strand diameter (round conductor).
 * For solid: OD = strand_dia
 * For stranded: OD = strand_dia × asm_factor (packing factor for round arrangement)
 *
 * Standard strand packing assembly factors for round stranded:
 *   1 strand → ×1, 7 → ×3, 19 → ×5, 37 → ×7, 61 → ×9
 */
export function strandPackingFactor(n_strands) {
  if (n_strands <= 1)  return 1
  if (n_strands <= 7)  return 3
  if (n_strands <= 19) return 5
  if (n_strands <= 37) return 7
  return 9
}

export function calcConductorOD(strand_dia, n_strands) {
  return strand_dia * strandPackingFactor(n_strands)
}

/**
 * Conductor weight per km per core (kg/km).
 * W = (ρ_km · K_cond² · K_core / R_max) · density
 *
 * This is derived from: W = n · (π/4) · d² · density · K_cond
 * which equals the above after substituting d from the resistance formula.
 */
export function calcConductorWeightPerKm(rho_km, K_cond, K_core, R_max, fill_factor, density) {
  return (rho_km * K_cond * K_cond * K_core / R_max) * density
}

// ─── INSULATION ───────────────────────────────────────────────────────────────

/**
 * Insulation weight per km per core (kg/km).
 * W = π · (d_conductor + t) · t · density
 * This is exact (not approximate) — equals π·t·(d_c + t).
 */
export function calcInsulWeightPerKm(d_conductor, t_insul, density) {
  return PI * (d_conductor + t_insul) * t_insul * density
}

export function diaOverInsul(d_conductor, t_insul) {
  return d_conductor + 2 * t_insul
}

// ─── LAY-UP ───────────────────────────────────────────────────────────────────

/**
 * Diameter over laid-up cores (round).
 * Uses assembly factor from IS standard tables.
 */
export function calcDiaOverLaidup(d_over_insul, n_cores, shape = 'round', standard = 'IS_7098_P1') {
  const f = getLaidupFactor(n_cores, shape, standard)
  return d_over_insul * f
}

// ─── TAPE / WRAPPING (surface density materials) ─────────────────────────────

/**
 * Weight per km of a helically wrapped tape.
 * length_per_m = π · d_over / (width_mm × (1 - overlap)) × n_layers × K_tape
 * weight_kg_km = surface_density_g_m2 × width_mm × length_per_m × 1000 (m→km) / 1e6 (g→kg)
 *
 * @param {number} d_over        - Diameter under tape (mm)
 * @param {number} tape_t        - Tape thickness (mm) — used to add to d_over
 * @param {number} tape_width    - Tape width (mm)
 * @param {number} overlap_pct   - Overlap percent (e.g. 25 for 25%)
 * @param {number} n_layers      - Number of tape layers
 * @param {number} surface_density - g/m² (for foil/tape materials)
 * @param {number} K_tape        - Lay correction for tape (typically 1.02–1.05)
 */
export function calcTapeWeightPerKm(d_over, tape_t, tape_width, overlap_pct, n_layers, surface_density, K_tape = 1.02) {
  const effective_overlap = 1 - overlap_pct / 100
  const length_per_m = (PI * d_over / (tape_width * effective_overlap)) * n_layers * K_tape
  const weight_g_per_m = surface_density * tape_width * length_per_m / 1000
  return weight_g_per_m  // g/m = kg/km
}

/**
 * For volumetric tapes (polyester tape, binding yarn with density in g/cm³):
 * weight_kg_km = π·(d_over + t)·t·density × n_layers × K_tape
 */
export function calcVolTapeWeightPerKm(d_over, tape_t, tape_width, overlap_pct, n_layers, density, K_tape = 1.0) {
  const effective_overlap = 1 - overlap_pct / 100
  const circumference = PI * (d_over + tape_t)
  const length_per_m = circumference / (tape_width * effective_overlap) * n_layers * K_tape
  return tape_t * tape_width * density * length_per_m  // kg/km (density in g/cm³, area in mm², length in m → kg/km)
}

export function diaOverTape(d_under, tape_t, n_layers = 1) {
  return d_under + 2 * tape_t * n_layers
}

// ─── SHEATH (extrusion) ───────────────────────────────────────────────────────

/**
 * Sheath weight per km (kg/km).
 * Tube:     W = π·(d_under + t)·t·density
 * Pressure: W = W_tube × pressure_fill_factor
 */
export function calcSheathWeightPerKm(d_under, t_sheath, density, extrusion_type, pressure_fill) {
  const w_tube = PI * (d_under + t_sheath) * t_sheath * density
  return w_tube * (extrusion_type === 'pressure' ? pressure_fill : 1)
}

export function diaOverSheath(d_under, t_sheath) {
  return d_under + 2 * t_sheath
}

// Min sheath thickness = nom × 0.8 (per IS standards)
export function minSheathThickness(t_nom) {
  return t_nom * 0.8
}

// ─── ARMOUR (IS 7098 P1 / IS 1554) ───────────────────────────────────────────

export function calcArmourWeightPerKm(d_under_armour, arm_type, arm_density, arm_d, strip_w, strip_t, packing_factor) {
  if (arm_type === 'wire') {
    const n = Math.round((PI * d_under_armour / arm_d) * (packing_factor ?? 0.9))
    return 0.7854 * arm_d * arm_d * arm_density * n  // kg/km
  }
  if (arm_type === 'strip') {
    const n = Math.round((PI * d_under_armour / strip_w) * (packing_factor ?? 0.95))
    return strip_w * strip_t * arm_density * n  // kg/km
  }
  return 0
}

export function diaOverArmour(d_under, arm_type, arm_d, strip_t) {
  if (arm_type === 'wire')  return d_under + arm_d * 2
  if (arm_type === 'strip') return d_under + strip_t * 2
  return d_under
}

// ─── DRUM COST ────────────────────────────────────────────────────────────────

export { selectDrum }

// ─── MAIN QUOTATION CALCULATOR ────────────────────────────────────────────────

/**
 * Full cable quotation calculation.
 *
 * @param {object} p - All cable parameters (built by the wizard)
 * @returns {object} - Per-km weights, costs, dimensions, datasheet data
 */
export function calcQuotation(p) {
  const r = {}  // results object

  // ── Material resistivity (Ω·mm²/m → ×1000 = Ω·mm²/km) ──────────────────
  const rho_km = (p.conductor_resistivity ?? 17.241) * 1000

  // ── K factors ────────────────────────────────────────────────────────────
  r.K_lay_cond = p.n_strands <= 1 ? 1.0 : calcKLay(p.lay_factor_cond, p.n_strands)
  r.K_lay_core = calcKLay(p.lay_factor_core, p.n_cores)

  // ── Conductor diameter ────────────────────────────────────────────────────
  r.strand_dia = calcStrandDia(
    rho_km, r.K_lay_cond, r.K_lay_core,
    p.R_max, p.n_strands, p.fill_factor
  )
  r.conductor_od = calcConductorOD(r.strand_dia, p.n_strands)

  // ── Conductor weight/cost per km per core ─────────────────────────────────
  r.wt_conductor_per_km_per_core = calcConductorWeightPerKm(
    rho_km, r.K_lay_cond, r.K_lay_core,
    p.R_max, p.fill_factor, p.conductor_density
  )
  // For 3.5C cables the neutral is a reduced cross-section — adjust multiplier accordingly
  const neutral_size = p.n_cores === 3.5 ? (NEUTRAL_CONDUCTOR[p.conductor_size] ?? null) : null
  const cond_multiplier = neutral_size != null
    ? 3 + neutral_size / p.conductor_size
    : p.n_cores
  r.wt_conductor_per_km = r.wt_conductor_per_km_per_core * cond_multiplier
  r.wt_conductor_total  = r.wt_conductor_per_km * p.order_km * (1 + (p.conductor_wastage ?? 1) / 100)
  r.cost_conductor_material = r.wt_conductor_total * (p.conductor_landed_cost ?? 0)
  r.cost_conductor_op = (p.op_cost_conductor_per_km ?? 0) * 1000 * p.order_km  // per meter × 1000 → per km
  r.cost_conductor = r.cost_conductor_material + r.cost_conductor_op

  // ── Insulation ────────────────────────────────────────────────────────────
  const d_cond = r.conductor_od
  r.t_insul_nom = p.t_insul
  r.t_insul_min = p.t_insul * 0.8
  r.dia_over_insul = diaOverInsul(d_cond, p.t_insul)
  r.wt_insul_per_km_per_core = calcInsulWeightPerKm(d_cond, p.t_insul, p.insul_density ?? 1.5)
  r.wt_insul_per_km = r.wt_insul_per_km_per_core * p.n_cores
  r.wt_insul_total  = r.wt_insul_per_km * p.order_km * (1 + (p.insul_wastage ?? 5) / 100)
  r.cost_insul_material = r.wt_insul_total * (p.insul_landed_cost ?? 0)
  r.cost_insul_op = (p.op_cost_insul_per_km ?? 0) * 1000 * p.order_km
  r.cost_insul = r.cost_insul_material + r.cost_insul_op
  r.color_code = p.color_code_custom ?? getColorCode(p.n_cores)

  // ── Laid-up ───────────────────────────────────────────────────────────────
  r.K_lay_laidup = calcKLay(p.lay_factor_laidup ?? 30, p.n_cores)
  r.dia_over_laidup = p.n_cores <= 1
    ? r.dia_over_insul
    : calcDiaOverLaidup(r.dia_over_insul, p.n_cores, p.conductor_shape ?? 'round', p.standard ?? 'IS_7098_P1')

  // Filler weight (if any)
  r.wt_filler_per_km = (p.filler_type && p.filler_type !== 'none') ? (p.filler_weight_per_km ?? 0) : 0
  r.wt_filler = r.wt_filler_per_km * p.order_km
  r.cost_filler = r.wt_filler * (p.filler_landed_cost ?? 0)

  // Binder weight
  r.wt_binder_per_km = (p.binder_type && p.binder_type !== 'none') ? (p.binder_weight_per_km ?? 0) : 0
  r.wt_binder = r.wt_binder_per_km * p.order_km
  r.cost_binder = r.wt_binder * (p.binder_landed_cost ?? 0)

  r.cost_laidup_op = (p.op_cost_laidup_per_km ?? 0) * 1000 * p.order_km

  // ── Binding tape ──────────────────────────────────────────────────────────
  const bind_d = r.dia_over_laidup
  r.t_bind = p.binding_tape_t ?? 0.25
  let bind_wt = 0
  const bind_layers = p.binding_tape_layers ?? 1
  if (p.binding_tape_surface_density) {
    bind_wt = calcTapeWeightPerKm(bind_d, r.t_bind, p.binding_tape_width ?? 10, p.binding_tape_overlap ?? 25, bind_layers, p.binding_tape_surface_density)
  } else if (p.binding_tape_density) {
    bind_wt = calcVolTapeWeightPerKm(bind_d, r.t_bind, p.binding_tape_width ?? 10, p.binding_tape_overlap ?? 25, bind_layers, p.binding_tape_density)
  }
  r.wt_binding_per_km = bind_wt
  r.wt_binding_total = bind_wt * p.order_km * (1 + (p.binding_wastage ?? 1) / 100)
  r.cost_binding = r.wt_binding_total * (p.binding_tape_landed_cost ?? 0)
  r.dia_over_binding = bind_wt > 0
    ? diaOverTape(r.dia_over_laidup, r.t_bind)
    : r.dia_over_laidup

  // ── Inner sheath ──────────────────────────────────────────────────────────
  let dia_before_is = r.dia_over_binding
  r.t_inner_sheath = p.t_inner_sheath
    ?? (p.has_inner_sheath ? getInnerSheathThickness(r.dia_over_laidup, p.standard ?? 'IS_7098_P1') : 0)
  r.wt_inner_sheath_per_km = 0
  r.cost_inner_sheath = 0
  if (r.t_inner_sheath > 0 && p.has_inner_sheath) {
    const is_pf = getPressureFillFactor(p.n_cores, p.inner_sheath_extrusion ?? 'tube', p.standard ?? 'IS_694')
    r.wt_inner_sheath_per_km = calcSheathWeightPerKm(dia_before_is, r.t_inner_sheath, p.inner_sheath_density ?? 1.5, p.inner_sheath_extrusion ?? 'tube', is_pf)
    r.wt_inner_sheath_total = r.wt_inner_sheath_per_km * p.order_km * (1 + (p.inner_sheath_wastage ?? 5) / 100)
    r.cost_inner_sheath = r.wt_inner_sheath_total * (p.inner_sheath_landed_cost ?? 0)
  }
  r.dia_over_inner_sheath = r.t_inner_sheath > 0 && p.has_inner_sheath
    ? diaOverSheath(dia_before_is, r.t_inner_sheath)
    : dia_before_is

  // ── Second binding tape (over inner sheath, if present) ───────────────────
  const bind2_d = r.dia_over_inner_sheath
  let bind2_wt = 0
  if (p.binding2_tape_density) {
    bind2_wt = calcVolTapeWeightPerKm(bind2_d, r.t_bind, p.binding_tape_width ?? 10, p.binding_tape_overlap ?? 25, 1, p.binding2_tape_density)
  }
  r.wt_binding2_per_km = bind2_wt
  r.wt_binding2_total = bind2_wt * p.order_km * (1 + (p.binding_wastage ?? 1) / 100)
  r.cost_binding2 = r.wt_binding2_total * (p.binding_tape_landed_cost ?? 0)
  r.dia_over_binding2 = bind2_wt > 0
    ? diaOverTape(bind2_d, r.t_bind)
    : bind2_d

  // ── Armour ────────────────────────────────────────────────────────────────
  const dia_under_armour = r.dia_over_binding2 || r.dia_over_inner_sheath
  r.arm_type = p.armour_type ?? 'none'
  r.arm_d = p.arm_d
  r.strip_w = p.strip_w
  r.strip_t = p.strip_t
  if (r.arm_type !== 'none') {
    if (!r.arm_d && !r.strip_t) {
      const dims = getArmourDims(dia_under_armour, p.standard ?? 'IS_7098_P1')
      r.arm_d   = dims[2]
      r.strip_t = dims[1]
      r.strip_w = p.strip_w ?? 4.0
    }
    r.n_armour_wires = r.arm_type === 'wire'
      ? Math.round((PI * dia_under_armour / r.arm_d) * (p.arm_packing ?? 0.9))
      : 0
    r.wt_armour_per_km = calcArmourWeightPerKm(
      dia_under_armour, r.arm_type,
      p.armour_density ?? 7.85,
      r.arm_d, r.strip_w, r.strip_t,
      p.arm_packing ?? 0.9
    )
  } else {
    r.n_armour_wires = 0
    r.wt_armour_per_km = 0
  }
  r.wt_armour_total = r.wt_armour_per_km * p.order_km
  r.cost_armour = r.wt_armour_total * (p.armour_landed_cost ?? 0)
  r.cost_armour_op = (p.op_cost_armour_per_km ?? 0) * 1000 * p.order_km
  r.dia_over_armour = diaOverArmour(dia_under_armour, r.arm_type, r.arm_d, r.strip_t)

  // ── Braid shield (BN 50288 P7 instrumentation cables) ────────────────────
  const dia_under_braid = r.dia_over_armour
  if (p.has_braid) {
    const braidRow = lookupStep(BN50288_BRAID, dia_under_braid)
    r.braid_wire_d = braidRow[1]
    const n_c   = p.braid_n_carriers ?? 8
    const n_w   = p.braid_n_wires   ?? 8
    const alpha = ((p.braid_angle   ?? 45) * PI) / 180
    const rho   = (p.braid_density  ?? 8.9) * 1000  // kg/m³
    r.wt_braid_per_km = n_c * n_w * (PI / 4) * Math.pow(r.braid_wire_d * 1e-3, 2) * (1000 / Math.cos(alpha)) * rho
    r.braid_coverage_pct = Math.min(100, Math.round(
      (n_c * n_w * r.braid_wire_d * Math.cos(alpha) / (PI * dia_under_braid * Math.sin(alpha))) * 100
    ))
    r.dia_over_braid = dia_under_braid + 2 * r.braid_wire_d
  } else {
    r.braid_wire_d = 0; r.wt_braid_per_km = 0; r.braid_coverage_pct = 0
    r.dia_over_braid = dia_under_braid
  }
  r.wt_braid_total = r.wt_braid_per_km * p.order_km
  r.cost_braid = r.wt_braid_total * (p.braid_landed_cost ?? 0)

  // ── Outer sheath ──────────────────────────────────────────────────────────
  const dia_under_os = r.dia_over_braid
  const is_armoured_for_os = r.arm_type !== 'none'
  r.t_outer_sheath = p.t_outer_sheath
    ?? getOsSheathThickness(dia_under_os, is_armoured_for_os, p.standard ?? 'IS_694')
  const os_pf = getPressureFillFactor(p.n_cores, p.outer_sheath_extrusion ?? 'tube', p.standard ?? 'IS_694')
  r.wt_outer_sheath_per_km = r.t_outer_sheath > 0
    ? calcSheathWeightPerKm(dia_under_os, r.t_outer_sheath, p.outer_sheath_density ?? 1.5, p.outer_sheath_extrusion ?? 'tube', os_pf)
    : 0
  r.wt_outer_sheath_total = r.wt_outer_sheath_per_km * p.order_km * (1 + (p.outer_sheath_wastage ?? 5) / 100)
  r.cost_outer_sheath_material = r.wt_outer_sheath_total * (p.outer_sheath_landed_cost ?? 0)
  r.cost_outer_sheath_op = (p.op_cost_sheath_per_km ?? 0) * 1000 * p.order_km
  r.cost_outer_sheath = r.cost_outer_sheath_material + r.cost_outer_sheath_op
  r.overall_dia = r.t_outer_sheath > 0
    ? diaOverSheath(dia_under_os, r.t_outer_sheath)
    : dia_under_os

  // ── Drum / packing ────────────────────────────────────────────────────────
  const packing_m = p.packing_length_m ?? 500
  const drum_mat  = p.drum_material ?? 'wood'
  const drum = selectDrum(r.overall_dia, packing_m, drum_mat)
  r.drum_label = drum.label
  r.drum_cost_each = drum.price
  r.n_drums = packing_m > 0 ? Math.ceil(p.order_km * 1000 / packing_m) : 0
  r.cost_drums_total = r.drum_cost_each * r.n_drums
  r.cost_packaging_per_m = r.n_drums > 0 ? r.cost_drums_total / (p.order_km * 1000) : 0

  // ── Total weights ─────────────────────────────────────────────────────────
  r.wt_total_per_km =
    r.wt_conductor_per_km +
    r.wt_insul_per_km +
    (r.wt_filler_per_km ?? 0) +
    (r.wt_binder_per_km ?? 0) +
    (r.wt_binding_per_km ?? 0) +
    (r.wt_inner_sheath_per_km ?? 0) +
    (r.wt_binding2_per_km ?? 0) +
    r.wt_armour_per_km +
    r.wt_braid_per_km +
    r.wt_outer_sheath_per_km

  // ── Total costs ───────────────────────────────────────────────────────────
  r.total_material_cost =
    r.cost_conductor_material +
    r.cost_insul_material +
    r.cost_filler +
    r.cost_binder +
    r.cost_binding +
    r.cost_binding2 +
    r.cost_inner_sheath +
    r.cost_armour +
    r.cost_braid +
    r.cost_outer_sheath_material +
    r.cost_drums_total

  r.total_op_cost =
    r.cost_conductor_op +
    r.cost_insul_op +
    r.cost_laidup_op +
    r.cost_armour_op +
    r.cost_outer_sheath_op

  r.total_mfg_cost = r.total_material_cost + r.total_op_cost
  r.profit_pct = p.profit_margin_pct ?? 15
  r.profit_amount = r.total_mfg_cost * r.profit_pct / 100
  r.quote_total = r.total_mfg_cost + r.profit_amount + r.cost_drums_total
  // Avoid double-counting drums (already in material cost above)
  r.quote_total = r.total_mfg_cost + r.profit_amount
  r.quote_per_km  = p.order_km > 0 ? r.quote_total / p.order_km : 0
  r.quote_per_m   = r.quote_per_km / 1000
  r.quote_per_m_with_packing = r.quote_per_m + r.cost_packaging_per_m

  return r
}

// ─── PARAMETER BUILDERS FROM WIZARD STATE ────────────────────────────────────

/**
 * Get DC resistance from IS 8130 table based on conductor material, class, size.
 */
export function getDcResistance(size_mm2, material, conductor_class) {
  const key = buildDcrKey(material, conductor_class)
  const table = DC_RESISTANCE[key]
  if (!table) return null
  return table[size_mm2] ?? null
}

export function buildDcrKey(material, conductor_class) {
  const cls = String(conductor_class).toLowerCase().replace('class ', 'cl').replace('cl.', 'cl')
  if (material.includes('Tinned') || material.includes('tinned')) {
    return `copper_tinned_${cls}`
  }
  if (material.toLowerCase().includes('aluminium') || material.toLowerCase().includes('aluminum')) {
    return `aluminium_${cls}`
  }
  return `copper_${cls}`
}

/**
 * Look up insulation thickness from standard reference tables.
 * Returns { insul_t, sheath_t, has_sheath }
 */
export function getStandardThicknesses(standard, category, size_mm2, n_cores, conductor_class, options = {}) {
  const isFlex = String(conductor_class).includes('5') || String(conductor_class).includes('6')

  if (standard === 'IS_694') {
    if (category === 'single_core_unsheathed') {
      const row = IS694_T1_SINGLE_CORE_UNSHEATHED[size_mm2]
      if (!row) return null
      return {
        insul_t: isFlex ? row.flex_insul : row.rigid_insul,
        sheath_t: 0,
        has_sheath: false,
      }
    }
    if (category === 'twin_parallel') {
      const row = IS694_T5_TWIN_PARALLEL[size_mm2]
      if (!row) return null
      return { insul_t: row.insul_t, sheath_t: 0, has_sheath: false }
    }
    if (category === 'flat_submersible') {
      const row = IS694_T4_FLAT[size_mm2]
      if (!row) return null
      return { insul_t: row.insul_t, sheath_t: row.sheath_t, has_sheath: true }
    }
    if (category === 'multicore_sheathed') {
      const insul_row = IS694_T1_SINGLE_CORE_UNSHEATHED[size_mm2]
      const insul_t = insul_row ? (isFlex ? insul_row.flex_insul : insul_row.rigid_insul) : 0.8

      let sheath_t = 0
      const nc = Math.round(n_cores)
      const col = Math.min(nc - 1, 4)  // 0-indexed, max col 4 = 5 cores

      if (isFlex) {
        if (nc >= 6) {
          // multicore table
          const sizes = [0.5, 0.75, 1.0, 1.5, 2.5]
          const si = sizes.indexOf(size_mm2)
          if (si >= 0 && IS694_T3B_MULTICORE_FLEX[nc]) {
            sheath_t = IS694_T3B_MULTICORE_FLEX[nc][si]
          }
        } else {
          if (IS694_T3_FLEX_SHEATHED[size_mm2]) {
            sheath_t = IS694_T3_FLEX_SHEATHED[size_mm2][col] ?? 1.0
          }
        }
      } else {
        if (IS694_T2_RIGID_SHEATHED[size_mm2]) {
          const col2 = Math.min(nc - 1, 3)
          sheath_t = IS694_T2_RIGID_SHEATHED[size_mm2][col2] ?? 1.0
        }
      }
      return { insul_t, sheath_t, has_sheath: true }
    }
  }

  if (standard === 'IS_7098_P1') {
    const tbl = IS7098P1_INSUL
    const insul_t = (n_cores === 1 ? tbl.armoured_sc : tbl.unarmoured_mc)[size_mm2] ?? 1.0
    return { insul_t, sheath_t: null, has_sheath: true }
  }

  if (standard === 'IS_1554_P1') {
    const tbl = IS1554P1_INSUL
    const insul_t = (n_cores === 1 ? tbl.armoured_sc : tbl.unarmoured_mc)[size_mm2] ?? 1.0
    return { insul_t, sheath_t: null, has_sheath: true }
  }

  if (standard === 'IS_17505_P1') {
    // insulation_subtype: 'XLPE' (default) or 'XL-HFFR'
    const isHffr = options?.insulation_subtype?.toUpperCase?.() === 'XL-HFFR'
    const sub = isHffr ? 'hffr' : 'xlpe'
    const key = n_cores === 1 ? `${sub}_armoured_sc` : `${sub}_unarmoured_mc`
    const insul_t = IS17505P1_INSUL[key]?.[size_mm2] ?? 1.0
    return { insul_t, sheath_t: null, has_sheath: true }
  }

  if (standard === 'BN_50288_P7') {
    // voltage_class: '90V' | '300V' | '500V' | '1100V'
    const vcMap = { '90V': 'v90', '300V': 'v300', '500V': 'v500', '1100V': 'v1100' }
    const vcKey = vcMap[options?.voltage_class] ?? 'v500'
    const row = BN50288_INSUL[size_mm2]
    const insul_t = row?.[vcKey] ?? 0.44
    return { insul_t, sheath_t: null, has_sheath: true }
  }

  return null
}

// ─── DATASHEET GENERATOR ─────────────────────────────────────────────────────

/**
 * Generate cable technical datasheet from calculation results.
 * Uses physics formulas per IEC 60228 / IS 8130 for electrical properties.
 */
export function generateDatasheet(p, r) {
  const alpha = p.conductor_temp_coeff ?? 0.00393  // copper temp coeff /°C
  const R20 = p.R_max  // Ω/km at 20°C

  const isXlpe = p.insul_material_name?.toUpperCase().includes('XLPE')
  // AC resistance at 90°C (XLPE rated temp) or 70°C (PVC)
  const T_rated = isXlpe ? 90 : 70
  const R_rated = R20 * (1 + alpha * (T_rated - 20))

  // Inductance per km (coaxial approximation): L = 0.2 · ln(D_i/d_c) mH/km
  const D_i = r.dia_over_insul ?? 0
  const d_c = r.conductor_od ?? 0
  const inductance_mH_km = D_i > 0 && d_c > 0
    ? 0.2 * Math.log(D_i / d_c)
    : null

  // Capacitance per km: C = 0.0241·ε_r / log10(D_i/d_c) μF/km
  const epsilon_r = isXlpe ? 2.5 : 8.0  // XLPE vs PVC
  const capacitance_uF_km = D_i > 0 && d_c > 0
    ? 0.0241 * epsilon_r / Math.log10(D_i / d_c)
    : null

  return {
    designation:             buildDesignation(p),
    standard:                p.standard,
    voltage_class:           p.voltage_class ?? (p.standard === 'IS_694' ? '450/750V' : '1.1kV'),
    n_cores:                 p.n_cores,
    conductor_size_mm2:      p.conductor_size,
    conductor_material:      p.conductor_material_name ?? p.conductor_material,
    insulation_type:         p.insul_material_name ?? p.insulation_type ?? 'PVC',
    armour_type:             r.arm_type,

    n_strands:               p.n_strands,
    strand_dia_mm:           r.strand_dia?.toFixed(4),
    conductor_od_mm:         r.conductor_od?.toFixed(3),
    fill_factor:             p.fill_factor,
    K_lay_cond:              r.K_lay_cond?.toFixed(5),
    K_lay_core:              r.K_lay_core?.toFixed(5),
    R_max_20C_ohm_km:        R20,
    R_rated_ohm_km:          R_rated?.toFixed(4),
    rated_temp_C:            T_rated,

    insul_thickness_nom_mm:  r.t_insul_nom,
    insul_thickness_min_mm:  r.t_insul_min?.toFixed(2),
    dia_over_insul_mm:       r.dia_over_insul?.toFixed(3),
    dia_over_laidup_mm:      r.dia_over_laidup?.toFixed(3),
    inner_sheath_t_mm:       r.t_inner_sheath > 0 ? r.t_inner_sheath?.toFixed(2) : null,
    dia_over_inner_mm:       r.t_inner_sheath > 0 ? r.dia_over_inner_sheath?.toFixed(3) : null,

    armour_wire_d_mm:        r.arm_type === 'wire' ? r.arm_d?.toFixed(2) : null,
    n_armour_wires:          r.n_armour_wires > 0 ? r.n_armour_wires : null,
    armour_strip_w_mm:       r.arm_type === 'strip' ? r.strip_w : null,
    armour_strip_t_mm:       r.arm_type === 'strip' ? r.strip_t?.toFixed(2) : null,
    dia_over_armour_mm:      r.arm_type !== 'none' ? r.dia_over_armour?.toFixed(3) : null,

    outer_sheath_t_mm:       r.t_outer_sheath > 0 ? r.t_outer_sheath?.toFixed(2) : null,
    overall_dia_mm:          r.overall_dia?.toFixed(2),
    approx_weight_kg_km:     r.wt_total_per_km?.toFixed(1),
    inductance_mH_km:        inductance_mH_km?.toFixed(4),
    capacitance_uF_km:       capacitance_uF_km?.toFixed(4),
    color_code:              r.color_code,
  }
}

// ─── DESIGNATION BUILDER ─────────────────────────────────────────────────────

export function buildDesignation(p) {
  const nc = p.n_cores
  const ncStr = nc === 3.5 ? '3½' : String(nc)
  const sizeStr = p.conductor_size
  const insul = p.insul_material_name?.toUpperCase().includes('XLPE') ? '2X' : 'Y'
  const arm = p.armour_type === 'wire' ? 'W' : p.armour_type === 'strip' ? 'Y' : ''
  const sheath = p.has_outer_sheath ? 'Y' : ''
  return `${ncStr}C×${sizeStr} ${insul}F${arm}${sheath}`
}

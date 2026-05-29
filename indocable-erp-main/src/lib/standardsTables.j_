/**
 * IS / IEC / BN Cable Standard Reference Tables
 * All values extracted from IS 694, IS 7098 P1, IS 1554 P1, IS 17505 P1,
 * BN 50288 P7, and IS 8130 reference sheets (Master sheets Qoutes.xlsx).
 */

// ─── DC RESISTANCE TABLE (IS 8130) — Ω/km at 20°C ───────────────────────────

export const DC_RESISTANCE = {
  copper_cl1:        { 0.5:36, 0.75:24.5, 1:18.1, 1.5:12.1, 2.5:7.41, 4:4.61, 6:3.08, 10:1.83, 16:1.15 },
  copper_cl2:        { 0.5:36, 0.75:24.5, 1:18.1, 1.5:12.1, 2.5:7.41, 4:4.61, 6:3.08, 10:1.83, 16:1.15, 25:0.727, 35:0.524, 50:0.387, 70:0.268, 95:0.193, 120:0.153, 150:0.124, 185:0.0991, 240:0.0754, 300:0.0601, 400:0.047, 500:0.0366, 630:0.0283, 800:0.0221, 1000:0.0176 },
  copper_cl5:        { 0.5:39, 0.75:26, 1:19.5, 1.5:13.3, 2.5:7.98, 4:4.95, 6:3.3, 10:1.91, 16:1.21, 25:0.78, 35:0.554, 50:0.386, 70:0.272, 95:0.206, 120:0.161, 150:0.129, 185:0.106, 240:0.0801, 300:0.0641, 400:0.0486, 500:0.0384 },
  copper_tinned_cl1: { 0.5:36.7, 0.75:24.8, 1:18.2, 1.5:12.2, 2.5:7.56, 4:4.7, 6:3.11, 10:1.84, 16:1.16 },
  copper_tinned_cl2: { 0.5:36.7, 0.75:24.8, 1:18.2, 1.5:12.2, 2.5:7.56, 4:4.7, 6:3.11, 10:1.84, 16:1.16, 25:0.734, 35:0.529, 50:0.391, 70:0.27, 95:0.195, 120:0.154, 150:0.126, 185:0.1, 240:0.0762, 300:0.0607, 400:0.0475, 500:0.0369, 630:0.0286, 800:0.0224, 1000:0.0177 },
  copper_tinned_cl5: { 0.5:40.1, 0.75:26.7, 1:20, 1.5:13.7, 2.5:8.21, 4:5.09, 6:3.39, 10:1.95, 16:1.24, 25:0.795, 35:0.565, 50:0.393, 70:0.277, 95:0.21, 120:0.164, 150:0.132, 185:0.107, 240:0.0817, 300:0.0654, 400:0.0495, 500:0.0391 },
  aluminium_cl1:     { 1:null, 1.5:18.1, 2.5:12.1, 4:7.41, 6:4.61, 10:3.08, 16:1.91 },
  aluminium_cl2:     { 1:29.5, 1.5:18.1, 2.5:12.1, 4:7.41, 6:4.61, 10:3.08, 16:1.91, 25:1.2, 35:0.868, 50:0.641, 70:0.443, 95:0.32, 120:0.253, 150:0.206, 185:0.164, 240:0.125, 300:0.1, 400:0.0778, 500:0.0605, 630:0.0469, 800:0.0367, 1000:0.0291 },
}

// ─── CONDUCTOR FILL FACTORS ────────────────────────────────────────────────────
export const CONDUCTOR_FILL_FACTOR = {
  class1_solid_round:           { cu: 1.0,  al: 1.0  },
  class2_round_uncompacted:     { cu: 0.75, al: 0.75 },
  class2_round_compacted:       { cu: 0.90, al: 0.92 },
  class2_sector_compacted:      { cu: 0.91, al: 0.93 },
  class5_flexible_round:        { cu: 0.74, al: null },
  class6_extraflex_round:       { cu: 0.68, al: null },
}

export const K_ELONG = {
  solid:  0,
  low:    0.15,
  medium: 0.25,
  high:   0.40,
}

export function getKElong(fill_factor, n_strands) {
  if (n_strands <= 1) return 0
  if (fill_factor > 0.90 || n_strands === 7) return K_ELONG.high
  if (fill_factor >= 0.88) return K_ELONG.medium
  return K_ELONG.low
}

// ─── ASSEMBLY (LAY-UP) FACTOR — IS 7098/1554/694 ─────────────────────────────
export const ASSEMBLY_FACTOR = {
  round:  { 1:1.0, 2:2.05, 3:2.18, 4:2.45, 5:2.75, 6:3.05, 7:3.05, 8:3.3, 9:3.3, 10:3.5, 12:4.16, 14:4.41, 19:5.0, 24:5.5 },
  sector: { 1:1.0, 2:2.05, 3:2.05, 3.5:2.05, 4:2.05 },
}

// ─── BN 50288 P7 LAY-UP FACTOR — extends to 100 elements ─────────────────────
// These are the element-count → laid-up diameter multipliers per BN 50288
export const BN50288_LAIDUP_FACTOR = {
  1:1, 2:2, 3:2.16, 4:2.42, 5:2.7, 6:3, 7:3, 8:3.45, 9:3.8, 10:4, 11:4, 12:4.16,
  13:4.41, 14:4.41, 15:4.7, 16:4.7, 17:5, 18:5, 19:5, 20:5.33, 21:5.33, 22:5.67,
  23:5.67, 24:6, 25:6, 26:6, 27:6.15, 28:6.41, 29:6.41, 30:6.41, 31:6.7, 32:6.7,
  33:6.7, 34:7, 35:7, 36:7, 37:7, 38:7.33, 39:7.33, 40:7.33, 41:7.67, 42:7.67,
  43:7.67, 44:8, 45:8, 46:8, 47:8, 48:8.15, 49:8.35, 50:8.35, 51:8.41, 52:8.41,
  53:8.41, 54:8.6, 55:8.7, 56:8.7, 57:8.7, 58:9, 59:9, 60:9, 61:9, 62:9, 63:9.35,
  64:9.35, 65:9.35, 66:9.35, 67:10, 68:10, 69:10, 70:10, 71:10, 72:10, 73:10.16,
  74:10.16, 75:10.16, 76:10.16, 77:10.35, 78:10.42, 79:10.42, 80:10.42, 81:10.42,
  82:10.42, 83:10.6, 84:10.7, 85:10.7, 86:10.7, 87:10.7, 88:11, 89:11, 90:11,
  91:11, 92:11, 93:11, 94:11.35, 95:11.35, 96:11.35, 97:11.35, 98:12, 99:12, 100:12,
}

export function getLaidupFactor(n_cores, shape = 'round', standard = 'IS_7098_P1') {
  if (standard === 'BN_50288_P7') {
    return BN50288_LAIDUP_FACTOR[Math.round(n_cores)] ?? 12
  }
  if (shape === 'sector') return ASSEMBLY_FACTOR.sector[n_cores] ?? ASSEMBLY_FACTOR.sector[4]
  const round = ASSEMBLY_FACTOR.round
  // step-down lookup for round
  let best = 1.0
  for (const [k, v] of Object.entries(round)) {
    if (Number(k) <= n_cores) best = v
  }
  return best
}

export const SECTOR_ANGLE = { 1:360, 2:180, 3:120, 3.5:100, 4:90, 5:360, 6:360 }

// ─── INNER SHEATH / BEDDING THICKNESS ────────────────────────────────────────

// IS 694 / IS 7098 / IS 1554 — [laid_up_od_min, min_thickness_mm]
export const INNER_SHEATH_THICKNESS = [
  [0,  0.3],
  [25, 0.4],
  [35, 0.5],
  [45, 0.6],
  [55, 0.7],
]

// IS 17505 P1 — significantly thicker inner sheath
export const IS17505_INNER_SHEATH = [
  [0,  0.8],
  [10, 1.0],
  [25, 1.2],
  [35, 1.4],
  [50, 1.6],
  [60, 1.8],
]

// BN 50288 P7 — bedding (inner sheath) thickness
export const BN50288_BEDDING = [
  [0,     1.0],
  [25.01, 1.2],
  [35.01, 1.4],
  [45.01, 1.6],
  [60.01, 1.8],
  [80.01, 2.0],
]

// ─── IS 694 TABLES (450/750V) ─────────────────────────────────────────────────

// Table 1: Single Core UNSHEATHED
export const IS694_T1_SINGLE_CORE_UNSHEATHED = {
  0.5:  { rigid_insul:0.6, flex_insul:0.6, max_od_rigid:2.3,  max_od_flex:2.6  },
  0.75: { rigid_insul:0.6, flex_insul:0.6, max_od_rigid:2.5,  max_od_flex:2.8  },
  1:    { rigid_insul:0.6, flex_insul:0.6, max_od_rigid:2.8,  max_od_flex:3.0  },
  1.5:  { rigid_insul:0.7, flex_insul:0.7, max_od_rigid:3.3,  max_od_flex:3.4  },
  2.5:  { rigid_insul:0.8, flex_insul:0.8, max_od_rigid:4.0,  max_od_flex:4.1  },
  4:    { rigid_insul:0.8, flex_insul:0.8, max_od_rigid:4.6,  max_od_flex:4.8  },
  6:    { rigid_insul:0.8, flex_insul:0.8, max_od_rigid:5.2,  max_od_flex:5.3  },
  10:   { rigid_insul:1.0, flex_insul:1.0, max_od_rigid:6.7,  max_od_flex:7.0  },
  16:   { rigid_insul:1.0, flex_insul:1.0, max_od_rigid:7.8,  max_od_flex:8.1  },
  25:   { rigid_insul:1.2, flex_insul:1.2, max_od_rigid:9.7,  max_od_flex:10.2 },
  35:   { rigid_insul:1.2, flex_insul:1.2, max_od_rigid:10.9, max_od_flex:11.7 },
  50:   { rigid_insul:1.4, flex_insul:1.4, max_od_rigid:12.8, max_od_flex:13.9 },
  70:   { rigid_insul:1.4, flex_insul:1.4, max_od_rigid:14.6, max_od_flex:16.0 },
  95:   { rigid_insul:1.6, flex_insul:1.6, max_od_rigid:17.1, max_od_flex:18.2 },
  120:  { rigid_insul:1.6, flex_insul:1.6, max_od_rigid:18.8, max_od_flex:20.2 },
  150:  { rigid_insul:1.8, flex_insul:1.8, max_od_rigid:20.9, max_od_flex:22.5 },
  185:  { rigid_insul:2.0, flex_insul:2.0, max_od_rigid:23.3, max_od_flex:24.9 },
  240:  { rigid_insul:2.2, flex_insul:2.2, max_od_rigid:26.6, max_od_flex:28.4 },
  300:  { rigid_insul:2.4, flex_insul:2.4, max_od_rigid:29.6, max_od_flex:31.0 },
  400:  { rigid_insul:2.6, flex_insul:2.6, max_od_rigid:33.2, max_od_flex:37.0 },
  500:  { rigid_insul:2.8, flex_insul:2.8, max_od_rigid:37.5, max_od_flex:40.0 },
  630:  { rigid_insul:3.0, flex_insul:3.0, max_od_rigid:42.0, max_od_flex:44.0 },
}

// Table 2: Rigid Class 2 Sheathed — sheathing thickness [1c, 2c, 3c, 4c]
export const IS694_T2_RIGID_SHEATHED = {
  1:    [0.9, 0.9, 0.9, 0.9],
  1.5:  [0.9, 0.9, 0.9, 1.0],
  2.5:  [1.0, 1.0, 1.0, 1.0],
  4:    [1.0, 1.0, 1.0, 1.1],
  6:    [1.0, 1.1, 1.2, 1.3],
  10:   [1.0, 1.3, 1.4, 1.4],
  16:   [1.1, 1.4, 1.4, 1.5],
  25:   [1.1, 1.5, 1.6, 1.7],
  35:   [1.1, 1.6, 1.7, 1.8],
  50:   [1.2, 2.0, 2.1, 2.2],
  70:   [1.3, 2.2, 2.3, 2.4],
  95:   [1.3, 2.4, 2.6, 2.6],
  120:  [1.4, 2.5, 2.7, 2.8],
}

// Table 3: Flexible Class 5 Sheathed — sheathing thickness [1c, 2c, 3c, 4c, 5c]
export const IS694_T3_FLEX_SHEATHED = {
  0.5:  [0.9, 0.9, 0.9, 0.9, 0.9],
  0.75: [0.9, 0.9, 0.9, 0.9, 0.9],
  1:    [0.9, 0.9, 0.9, 0.9, 1.0],
  1.5:  [0.9, 0.9, 0.9, 1.0, 1.1],
  2.5:  [1.0, 1.0, 1.0, 1.0, 1.1],
  4:    [1.1, 1.2, 1.2, 1.2, 1.3],
  6:    [1.1, 1.2, 1.2, 1.2, 1.3],
  10:   [1.3, 1.4, 1.4, 1.4, 1.5],
  16:   [1.4, 1.4, 1.4, 1.4, 1.6],
  25:   [1.4, 1.6, 1.6, 1.7, 1.8],
  35:   [1.6, 1.6, 1.7, 1.7, 1.9],
  50:   [2.0, 2.0, 2.0, 2.0, 2.2],
  70:   [2.2, 2.2, 2.2, 2.2, 2.4],
  95:   [2.4, 2.4, 2.4, 2.4, 2.7],
  120:  [2.5, 2.5, 2.5, 2.5, 2.9],
  150:  [2.6, 2.6, 2.6, 2.6, 3.0],
  185:  [2.8, 2.8, 2.8, 2.8, 3.2],
  240:  [3.0, 3.0, 3.0, 3.0, 3.5],
  300:  [3.2, 3.2, 3.2, 3.2, 3.8],
}

// Table 3B: Multicore Flexible 6–25 Cores — sheathing thickness
// Sizes: [0.5, 0.75, 1.0, 1.5, 2.5]
export const IS694_T3B_MULTICORE_FLEX = {
  6:  [0.9, 1.0, 1.0, 1.0, 1.1],
  7:  [0.9, 1.0, 1.0, 1.0, 1.1],
  8:  [1.0, 1.0, 1.0, 1.1, 1.2],
  9:  [1.0, 1.1, 1.1, 1.1, 1.3],
  10: [1.0, 1.1, 1.1, 1.1, 1.3],
  12: [1.0, 1.1, 1.1, 1.1, 1.3],
  13: [1.0, 1.1, 1.1, 1.2, 1.3],
  14: [1.0, 1.1, 1.1, 1.2, 1.3],
  15: [1.1, 1.2, 1.2, 1.2, 1.4],
  16: [1.1, 1.2, 1.2, 1.2, 1.4],
  17: [1.1, 1.2, 1.2, 1.3, 1.4],
  18: [1.1, 1.2, 1.3, 1.3, 1.4],
  19: [1.1, 1.2, 1.3, 1.3, 1.4],
  20: [1.2, 1.3, 1.4, 1.4, 1.5],
  21: [1.2, 1.3, 1.4, 1.4, 1.5],
  22: [1.2, 1.3, 1.4, 1.4, 1.5],
  23: [1.2, 1.3, 1.4, 1.4, 1.5],
  24: [1.2, 1.3, 1.4, 1.4, 1.5],
  25: [1.2, 1.3, 1.4, 1.4, 1.5],
}
export const IS694_T3B_SIZES = [0.5, 0.75, 1.0, 1.5, 2.5]

// Table 4: Flat Submersible Cable
export const IS694_T4_FLAT = {
  0.5:  { insul_t:0.6, sheath_t:0.9, max_2core:'7.2×4.9',   max_3core:'9.6×4.9'   },
  0.75: { insul_t:0.6, sheath_t:0.9, max_2core:'7.8×5.2',   max_3core:'10.5×5.2'  },
  1:    { insul_t:0.6, sheath_t:0.9, max_2core:'8.0×5.4',   max_3core:'11.0×5.4'  },
  1.5:  { insul_t:0.6, sheath_t:0.9, max_2core:'8.6×5.6',   max_3core:'10.7×5.3'  },
  2.5:  { insul_t:0.7, sheath_t:1.0, max_2core:'10.5×6.6',  max_3core:'13.0×6.2'  },
  4:    { insul_t:0.8, sheath_t:1.0, max_2core:'12.0×7.4',  max_3core:'15.3×7.1'  },
  6:    { insul_t:0.8, sheath_t:1.1, max_2core:'13.0×8.0',  max_3core:'19.2×8.4'  },
  10:   { insul_t:1.0, sheath_t:1.4, max_2core:'16.0×9.6',  max_3core:'24.2×10.4' },
  16:   { insul_t:1.0, sheath_t:1.4, max_2core:'18.5×11.0', max_3core:'29.0×12.4' },
  25:   { insul_t:1.2, sheath_t:2.0, max_2core:'22.5×13.0', max_3core:'36.5×15.7' },
  35:   { insul_t:1.2, sheath_t:2.0, max_2core:'25.5×14.5', max_3core:'40.5×17.2' },
  50:   { insul_t:1.4, sheath_t:2.2, max_2core:'29.0×16.5', max_3core:'46.5×19.3' },
  70:   { insul_t:1.4, sheath_t:2.2, max_2core:null,        max_3core:'52.0×21.0' },
  95:   { insul_t:1.6, sheath_t:2.4, max_2core:null,        max_3core:'61.0×24.5' },
}

// Table 5: Twin Parallel Unsheathed
export const IS694_T5_TWIN_PARALLEL = {
  0.5:  { insul_t:0.6, max_wxh:'2.6×5.2' },
  0.75: { insul_t:0.6, max_wxh:'2.8×5.6' },
  1:    { insul_t:0.6, max_wxh:'3.0×6.0' },
  1.5:  { insul_t:0.6, max_wxh:'3.3×6.6' },
  2.5:  { insul_t:0.8, max_wxh:'4.0×8.0' },
  4:    { insul_t:0.8, max_wxh:'4.8×9.6' },
}

// ─── IS 694 COLOR CODES ────────────────────────────────────────────────────────
export const IS694_COLOR_CODE = {
  1:    ['Red'],
  2:    ['Red', 'Black'],
  3:    ['Red', 'Yellow', 'Blue'],
  3.5:  ['Red', 'Yellow', 'Blue', 'Black'],
  4:    ['Red', 'Yellow', 'Blue', 'Black'],
  5:    ['Red', 'Yellow', 'Blue', 'Black', 'Grey'],
}
export function getColorCode(n_cores) {
  if (IS694_COLOR_CODE[n_cores]) return IS694_COLOR_CODE[n_cores]
  return Array.from({ length: Math.round(n_cores) }, (_, i) => String(i + 1))
}

// ─── PRESSURE EXTRUSION FILL FACTOR ──────────────────────────────────────────

// IS 694 values (different from IS 7098/1554/17505)
export const PRESSURE_FILL_FACTOR_694 = {
  1:  { tube:1, pressure:1    },
  2:  { tube:1, pressure:1.4  },
  3:  { tube:1, pressure:1.25 },
  4:  { tube:1, pressure:1.3  },
  5:  { tube:1, pressure:1.35 },
  6:  { tube:1, pressure:1.3  },
  7:  { tube:1, pressure:1.15 },
  8:  { tube:1, pressure:1.3  },
  9:  { tube:1, pressure:1.3  },
  10: { tube:1, pressure:1.35 },
  11: { tube:1, pressure:1.35 },
  12: { tube:1, pressure:1.25 },
  13: { tube:1, pressure:1.35 },
  14: { tube:1, pressure:1.35 },
  15: { tube:1, pressure:1.35 },
  16: { tube:1, pressure:1.35 },
  17: { tube:1, pressure:1.3  },
  18: { tube:1, pressure:1.3  },
  19: { tube:1, pressure:1.2  },
  20: { tube:1, pressure:1.35 },
  25: { tube:1, pressure:1.4  },
}

// IS 7098/1554/17505/BN 50288 values (shared — same across all four standards)
export const PRESSURE_FILL_FACTOR_7098 = {
  1:   { tube:1, pressure:1    },
  2:   { tube:1, pressure:1.35 },
  3:   { tube:1, pressure:1.2  },
  3.5: { tube:1, pressure:1.22 },
  4:   { tube:1, pressure:1.25 },
  5:   { tube:1, pressure:1.28 },
  6:   { tube:1, pressure:1.3  },
  7:   { tube:1, pressure:1.15 },
  8:   { tube:1, pressure:1.3  },
  9:   { tube:1, pressure:1.3  },
  10:  { tube:1, pressure:1.35 },
  11:  { tube:1, pressure:1.35 },
  12:  { tube:1, pressure:1.25 },
  13:  { tube:1, pressure:1.35 },
  14:  { tube:1, pressure:1.35 },
  15:  { tube:1, pressure:1.35 },
  16:  { tube:1, pressure:1.35 },
  17:  { tube:1, pressure:1.3  },
  18:  { tube:1, pressure:1.3  },
  19:  { tube:1, pressure:1.2  },
  20:  { tube:1, pressure:1.35 },
  21:  { tube:1, pressure:1.35 },
  22:  { tube:1, pressure:1.35 },
  23:  { tube:1, pressure:1.35 },
  24:  { tube:1, pressure:1.35 },
  25:  { tube:1, pressure:1.4  },
}

// Keep legacy name for backward compatibility
export const PRESSURE_FILL_FACTOR = PRESSURE_FILL_FACTOR_694

export function getPressureFillFactor(n_cores, extrusion_type, standard = 'IS_694') {
  const table = (standard === 'IS_694') ? PRESSURE_FILL_FACTOR_694 : PRESSURE_FILL_FACTOR_7098
  const n = n_cores === 3.5 ? 3.5 : Math.round(n_cores)
  const row = table[n] ?? table[25]
  return extrusion_type === 'pressure' ? row.pressure : row.tube
}

// ─── IS 7098 P1 TABLES (1.1kV XLPE Armoured / Unarmoured) ─────────────────────

// Insulation thickness — corrected from Excel reference sheet
// SC Armoured = single-core armoured (thicker); MC/SC Unarmoured = multicore or unarmoured SC
export const IS7098P1_INSUL = {
  armoured_sc:   { 0.5:1.0, 0.75:1.0, 1:1.0, 1.5:1.0, 2.5:1.0, 4:1.0, 6:1.0, 10:1.0, 16:1.0, 25:1.2, 35:1.2, 50:1.3, 70:1.4, 95:1.4, 120:1.5, 150:1.7, 185:1.9, 240:2.0, 300:2.1, 400:2.4, 500:2.6, 630:2.8, 800:3.1, 1000:3.3 },
  unarmoured_mc: { 0.5:0.7, 0.75:0.7, 1:0.7, 1.5:0.7, 2.5:0.7, 4:0.7, 6:0.7, 10:0.7, 16:0.7, 25:0.9, 35:0.9, 50:1.0, 70:1.1, 95:1.1, 120:1.2, 150:1.4, 185:1.6, 240:1.7, 300:1.8, 400:2.0, 500:2.2, 630:2.4, 800:2.6, 1000:2.8 },
}

// Armour wire/strip dimensions [dia_under_armour_min, strip_t, wire_d]
export const IS7098P1_ARMOUR = [
  [0,  0.8, 0.9],
  [10, 0.8, 1.4],
  [13, 0.8, 1.6],
  [25, 0.8, 2.0],
  [40, 1.4, 2.5],
  [55, 1.4, 3.15],
  [70, 1.4, 4.0],
]

// Outer sheath thickness [dia_under_sheath_min, nom_unarmoured, min_armoured]
// nom_unarmoured = what goes on drawing for unarmoured cables
// min_armoured   = minimum required when over armour (≈ 0.69 × nominal)
export const IS7098P1_OS = [
  [0,  1.8, 1.24],
  [15, 2.0, 1.40],
  [25, 2.2, 1.56],
  [35, 2.4, 1.72],
  [45, 2.6, 1.88],
  [50, 2.8, 2.04],
  [55, 3.0, 2.20],
  [60, 3.2, 2.36],
  [65, 3.4, 2.52],
  [70, 3.6, 2.68],
  [75, 3.8, 2.84],
  [85, 4.0, 3.00],
]

// ─── IS 1554 P1 TABLES (1.1kV PVC Armoured / Unarmoured) ─────────────────────

// Corrected from Excel — PVC insulation is thicker than XLPE (IS 7098)
export const IS1554P1_INSUL = {
  armoured_sc:   { 1.5:1.1, 2.5:1.2, 4:1.3, 6:1.3, 10:1.3, 16:1.3, 25:1.5, 35:1.5, 50:1.7, 70:1.7, 95:1.9, 120:1.9, 150:2.1, 185:2.3, 240:2.5, 300:2.7, 400:3.0, 500:3.4, 630:3.9, 800:3.9, 1000:3.9 },
  unarmoured_mc: { 1.5:0.8, 2.5:0.9, 4:1.0, 6:1.0, 10:1.0, 16:1.0, 25:1.2, 35:1.2, 50:1.4, 70:1.4, 95:1.6, 120:1.6, 150:1.8, 185:2.0, 240:2.2, 300:2.4, 400:2.6, 500:3.0, 630:3.4, 800:3.4, 1000:3.4 },
}

// IS 1554 uses same armour and outer sheath tables as IS 7098

// ─── IS 17505 P1 TABLES (1.1kV XLPE / XL-HFFR Flexible Armoured) ─────────────

// Insulation — two subtype variants: XLPE and XL-HFFR (HFFR is thicker)
export const IS17505P1_INSUL = {
  xlpe_armoured_sc:    { 1.5:1.0, 2.5:1.0, 4:1.0, 6:1.0, 10:1.0, 16:1.0, 25:1.2, 35:1.2, 50:1.3, 70:1.4, 95:1.4, 120:1.5, 150:1.7, 185:1.9, 240:2.0, 300:2.1, 400:2.4, 500:2.6, 630:2.8 },
  xlpe_unarmoured_mc:  { 1.5:0.7, 2.5:0.7, 4:0.7, 6:0.7, 10:0.7, 16:0.7, 25:0.9, 35:0.9, 50:1.0, 70:1.1, 95:1.1, 120:1.2, 150:1.4, 185:1.6, 240:1.7, 300:1.8, 400:2.0, 500:2.2, 630:2.4 },
  hffr_armoured_sc:    { 1.5:1.1, 2.5:1.1, 4:1.1, 6:1.1, 10:1.2, 16:1.2, 25:1.3, 35:1.3, 50:1.4, 70:1.5, 95:1.5, 120:1.7, 150:1.9, 185:2.1, 240:2.1, 300:2.3, 400:2.6, 500:2.8, 630:3.0 },
  hffr_unarmoured_mc:  { 1.5:0.8, 2.5:0.8, 4:0.8, 6:0.8, 10:0.9, 16:0.9, 25:1.0, 35:1.0, 50:1.1, 70:1.2, 95:1.2, 120:1.4, 150:1.6, 185:1.8, 240:1.8, 300:2.0, 400:2.2, 500:2.4, 630:2.6 },
}

// IS 17505 outer sheath — starts thinner than IS 7098 (1.6 vs 1.8 for small OD)
export const IS17505P1_OS = [
  [0,  1.6, 1.08],
  [10, 1.8, 1.24],
  [15, 2.0, 1.40],
  [20, 2.0, 1.40],
  [25, 2.2, 1.56],
  [35, 2.4, 1.72],
  [40, 2.6, 1.88],
  [50, 3.0, 2.04],
  [55, 3.2, 2.20],
  [60, 3.4, 2.36],
  [65, 3.6, 2.52],
  [70, 3.8, 2.68],
  [75, 4.0, 3.00],
]

// ─── BN 50288 P7 TABLES (Instrumentation Cables) ─────────────────────────────

// Insulation — voltage-class rated (not size-based above conductor OD)
// { size_mm2: { fcd, v90, v300, v500, v1100 } }
export const BN50288_INSUL = {
  0.5:  { fcd:0.8,  v90:0.20, v300:0.26, v500:0.44, v1100:0.60 },
  0.75: { fcd:1.0,  v90:0.20, v300:0.26, v500:0.44, v1100:0.60 },
  1.0:  { fcd:1.1,  v90:0.26, v300:0.26, v500:0.44, v1100:0.60 },
  1.5:  { fcd:1.4,  v90:0.30, v300:0.35, v500:0.44, v1100:0.60 },
  2.5:  { fcd:1.8,  v90:null, v300:null,  v500:0.53, v1100:0.70 },
}

// BN 50288 armour wire dims [dia_under_armour_min, strip_t, wire_d]
// Smaller wire diameters than IS 7098 for instrumentation cables
export const BN50288_ARMOUR = [
  [0,  0.8, 0.90],
  [10, 0.8, 0.90],
  [15, 0.8, 0.90],
  [25, 0.8, 1.25],
  [35, 1.4, 1.60],
  [45, 1.4, 2.00],
  [60, 1.4, 2.50],
  [85, 1.4, 3.15],
]

// BN 50288 outer sheath — same table as IS 7098
// (reference: same data in BN 50288 reference sheet)
export const BN50288_OS = IS7098P1_OS  // alias

// BN 50288 braiding wire diameter [dia_under_braid_min, wire_d_nom, wire_d_min, up_to_dia]
export const BN50288_BRAID = [
  [0,     0.10, 0.098, 3   ],
  [3.01,  0.15, 0.146, 6   ],
  [6.01,  0.20, 0.196, 15  ],
  [15.01, 0.30, 0.296, 25  ],
  [25.01, 0.40, 0.396, 999 ],
]

// ─── NEUTRAL CONDUCTOR SIZE (for 3.5C cables) ─────────────────────────────────
// IS 7098 / IS 1554 / IS 17505
export const NEUTRAL_CONDUCTOR = {
  25:  16,
  35:  16,
  50:  25,
  70:  35,
  95:  50,
  120: 70,
  150: 70,
  185: 95,
  240: 120,
  300: 150,
  400: 185,
  500: 240,
  630: 300,
}

// ─── MINIMUM STRAND COUNT (IS 8130) ──────────────────────────────────────────
// [size_mm2]: [non_compacted, compacted_round, sector_shaped]
export const MIN_STRANDS = {
  1.5:  [7, null, null],
  2.5:  [7, null, null],
  4:    [7, null, null],
  6:    [7, null, null],
  10:   [7,  6,  6],
  16:   [7,  6,  6],
  25:   [7,  6,  6],
  35:   [7,  6,  6],
  50:   [19, 6,  6],
  70:   [19, 12, 12],
  95:   [19, 15, 15],
  120:  [37, 18, 18],
  150:  [37, 18, 18],
  185:  [37, 30, 30],
  240:  [61, 34, 34],
  300:  [61, 34, 34],
  400:  [61, 53, 53],
  500:  [61, 53, 53],
  630:  [91, 53, 53],
  800:  [91, 53, 53],
  1000: [91, 53, 53],
}

// ─── TAPE WIDTH REFERENCE ─────────────────────────────────────────────────────
// [od_min, recommended_tape_width_mm]
export const TAPE_WIDTH_REF = [
  [0,    6],
  [5.1,  10],
  [10.1, 15],
  [15.1, 20],
  [20.1, 25],
  [25.1, 30],
  [35.1, 40],
  [50.1, 50],
  [70.1, 60],
  [90.1, 75],
]

// ─── DRUM SIZES AND PRICES ────────────────────────────────────────────────────
export const DRUM_TABLE = [
  [13, '34×14×20', 1815,  18900, 3570,  '28×14×20', 1500,  12600, 2380],
  [14, '36×14×20', 2305,  20250, 3825,  '28×14×20', 1500,  12600, 2380],
  [15, '38×14×20', 2480,  22050, 4165,  '30×14×20', 1590,  13950, 2635],
  [16, '40×14×20', 2660,  23850, 4505,  '32×14×20', 1696,  15300, 2890],
  [17, '42×14×20', 2935,  26100, 4930,  '34×14×20', 1815,  17100, 3230],
  [18, '44×14×20', 3050,  27900, 5270,  '36×14×20', 2305,  18900, 3570],
  [19, '46×14×20', 3257,  28800, 5440,  '36×14×20', 2305,  18900, 3570],
  [20, '48×14×20', 3475,  29250, 5525,  '38×14×20', 2480,  20250, 3825],
  [22, '48×16×26', 3450,  30600, 5780,  '42×16×20', 2935,  23850, 4505],
  [24, '52×18×26', 4165,  33750, 6375,  '42×18×26', 3080,  24750, 4675],
  [26, '56×20×26', 5000,  38250, 7225,  '42×20×26', 3190,  24750, 4675],
  [28, '60×22×26', 9500,  42750, 8075,  '48×22×26', 3475,  30600, 5780],
  [30, '60×22×30', 9800,  44100, 8330,  '48×22×26', 3450,  30600, 5780],
  [32, '64×24×30', 10200, 45900, 8670,  '54×24×26', 4515,  36900, 6970],
  [36, '70×26×30', 10860, 48870, 9231,  '56×26×30', 4865,  38700, 7310],
  [38, '76×30×30', 12200, 54900, 10370, '60×28×30', 6000,  44100, 8330],
  [41, '80×30×30', 13000, 58500, 11050, '62×28×30', 6250,  45000, 8500],
  [45, '84×34×34', 14200, 63900, 12070, '68×32×30', 7000,  47250, 8925],
  [48, '86×34×34', 14800, 66600, 12580, '70×32×32', 10860, 48870, 9231],
  [50, 'Custom',   0,     0,     0,     '72×32×32', 11500, 51750, 9775],
  [53, 'Custom',   0,     0,     0,     '76×32×32', 12200, 54900, 10370],
  [57, 'Custom',   0,     0,     0,     '80×32×32', 13000, 58500, 11050],
  [64, 'Custom',   0,     0,     0,     '86×34×34', 14500, 65250, 12325],
  [71, 'Custom',   0,     0,     0,     '90×40×40', 15800, 71100, 13430],
  [999,'Custom',   0,     0,     0,     '90×40×40', 15800, 71100, 13430],
]

export function selectDrum(cable_od_mm, packing_length_m, drum_material = 'wood') {
  const col_label = packing_length_m >= 900 ? 1 : 5
  const col_wood  = packing_length_m >= 900 ? 2 : 6
  const col_metal = packing_length_m >= 900 ? 3 : 7
  const col_ply   = packing_length_m >= 900 ? 4 : 8

  let selected = DRUM_TABLE[DRUM_TABLE.length - 1]
  for (const row of DRUM_TABLE) {
    if (cable_od_mm <= row[0]) { selected = row; break }
  }

  const prices = { wood: selected[col_wood], metal: selected[col_metal], plywood: selected[col_ply] }
  return {
    label: selected[col_label],
    price: prices[drum_material] || prices.wood,
    wood_price: selected[col_wood],
    metal_price: selected[col_metal],
    plywood_price: selected[col_ply],
  }
}

// ─── OPERATING COSTS (from BOM sheet) ─────────────────────────────────────────
export const OPERATING_COST = {
  rbd_aluminium:      { per: 'kg', std_cost: 2.16 },
  rbd_copper:         { per: 'kg', std_cost: 3.68 },
  copper_annealer:    { per: 'kg', std_cost: 2.09 },
  iwd_copper:         { per: 'kg', std_cost: 4.93 },
  fwd_copper:         { per: 'kg', std_cost: 6.23 },
  tinning:            { per: 'kg', std_cost: 2.69 },
  stranding_7:        { per: 'mtr', std_cost: 0.577 },
  stranding_19:       { per: 'mtr', std_cost: 0.839 },
  stranding_37:       { per: 'mtr', std_cost: 1.143 },
  stranding_61:       { per: 'mtr', std_cost: 1.515 },
  extruder_65mm:      { per: 'mtr', std_cost: 0.244 },
  extruder_80mm_s:    { per: 'mtr', std_cost: 0.511 },
  extruder_80mm_m:    { per: 'mtr', std_cost: 0.767 },
  extruder_80mm_l:    { per: 'mtr', std_cost: 1.534 },
  bunching:           { per: 'mtr', std_cost: 1.644 },
  skip_stranding:     { per: 'mtr', std_cost: 0.202 },
  laidup_3plus1:      { per: 'mtr', std_cost: 0.924 },
  drum_twister:       { per: 'mtr', std_cost: 2.383 },
  armouring:          { per: 'mtr', std_cost: 1.363 },
}

// ─── GENERIC LOOKUP HELPER ────────────────────────────────────────────────────
export function lookupStep(table, value) {
  let result = table[0]
  for (const row of table) {
    if (value >= row[0]) result = row
    else break
  }
  return result
}

// ─── HELPER FUNCTIONS ─────────────────────────────────────────────────────────

export function getInnerSheathThickness(dia_over_laidup, standard = 'IS_7098_P1') {
  if (standard === 'IS_17505_P1') return lookupStep(IS17505_INNER_SHEATH, dia_over_laidup)[1]
  if (standard === 'BN_50288_P7') return lookupStep(BN50288_BEDDING, dia_over_laidup)[1]
  return lookupStep(INNER_SHEATH_THICKNESS, dia_over_laidup)[1]
}

export function getArmourDims(dia_under_armour, standard = 'IS_7098_P1') {
  if (standard === 'BN_50288_P7') return lookupStep(BN50288_ARMOUR, dia_under_armour)
  return lookupStep(IS7098P1_ARMOUR, dia_under_armour)
}

/**
 * @param {number} dia_under_sheath  OD just before outer sheath is applied (mm)
 * @param {boolean} is_armoured      true → return armoured minimum, false → return unarmoured nominal
 * @param {string} standard          cable standard key
 * @returns {number} outer sheath thickness in mm; 0 for IS_694 (handled by standard tables)
 */
export function getOsSheathThickness(dia_under_sheath, is_armoured = false, standard = 'IS_7098_P1') {
  if (standard === 'IS_694') return 0  // IS 694 outer sheath comes from T2/T3 standard tables
  const table = standard === 'IS_17505_P1' ? IS17505P1_OS : IS7098P1_OS
  const row = lookupStep(table, dia_under_sheath)
  return is_armoured ? row[2] : row[1]
}

export function getTapeWidth(cable_od) {
  return lookupStep(TAPE_WIDTH_REF, cable_od)[1]
}

export function getNeutralSize(main_size_mm2) {
  return NEUTRAL_CONDUCTOR[main_size_mm2] ?? null
}

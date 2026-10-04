/**
 * The odds of a dice pool: its range, average, and chance of reaching a target.
 *
 * Pure, so it can be unit-tested. Distributions are worked out exactly wherever that is cheap —
 * sums by convolution, advantage as the best of two independent sets, keep-highest/lowest by order
 * statistics, exploding dice until the remaining chance is negligible — and estimated from a fixed
 * number of seeded simulated rolls where exact work would cost too much. The seed comes from the
 * pool itself, so the same pool always shows the same numbers.
 *
 * @typedef {object} Distribution
 * @property {number} min          The lowest total.
 * @property {Float64Array} p      p[i] is the chance of a total of min + i.
 * @property {boolean} approximate  Whether any part came from simulation.
 * @property {boolean} unbounded    Whether the total has no maximum (exploding dice).
 */

import { parseDieTerm } from "./dice.mjs";
import { getDiceGroups } from "./state.mjs";

/** Exploding dice are followed until the chance of going further is below this. */
const EXPLODE_EPSILON = 1e-7;
const MAX_EXPLOSIONS = 30;

/** Simulated rolls used when an exact answer would cost too much. */
const SAMPLES = 20000;

/** Above this many steps, keep-highest/lowest is simulated instead of worked out exactly. */
const MAX_EXACT_KEEP_WORK = 4e6;

/** Totals wider than this are simulated too, to bound memory. */
const MAX_SPAN = 20000;

const dist = (min, p, { approximate = false, unbounded = false } = {}) => ({ min, p, approximate, unbounded });

/** A single die: 1 to faces, or -1/0/+1 for a Fate die. */
export function dieDistribution(faces) {
  if ( faces === "F" ) return dist(-1, Float64Array.of(1 / 3, 1 / 3, 1 / 3));
  return dist(1, new Float64Array(faces).fill(1 / faces));
}

/** A die that rolls again and adds whenever it shows its highest face. */
export function explodingDistribution(faces) {
  if ( faces < 2 ) return null;
  let depth = 0;
  while ( (depth < MAX_EXPLOSIONS) && (faces ** -(depth + 1) > EXPLODE_EPSILON) ) depth++;
  // Totals faces*k + r (r = 1..faces-1) after k explosions; the rest is lumped at the cut-off.
  const p = new Float64Array((faces * depth) + faces);
  for ( let k = 0; k <= depth; k++ ) {
    const chance = faces ** -(k + 1);
    for ( let r = 1; r < faces; r++ ) p[(faces * k) + r - 1] += chance;
  }
  p[(faces * (depth + 1)) - 1] += faces ** -(depth + 1);
  return dist(1, p, { unbounded: true });
}

/** The distribution of a + b for independent a and b. */
export function convolve(a, b) {
  const p = new Float64Array(a.p.length + b.p.length - 1);
  for ( let i = 0; i < a.p.length; i++ ) {
    const ai = a.p[i];
    if ( !ai ) continue;
    for ( let j = 0; j < b.p.length; j++ ) p[i + j] += ai * b.p[j];
  }
  return dist(a.min + b.min, p, merge(a, b));
}

const merge = (a, b) => ({ approximate: a.approximate || b.approximate, unbounded: a.unbounded || b.unbounded });

/** The sum of n independent copies of d, by repeated squaring. */
export function sumOf(d, n) {
  let result = null;
  let base = d;
  while ( n > 0 ) {
    if ( n & 1 ) result = result ? convolve(result, base) : base;
    n >>= 1;
    if ( n ) base = convolve(base, base);
  }
  return result ?? dist(0, Float64Array.of(1));
}

export const shift = (d, k) => dist(d.min + k, d.p, d);

/** The distribution of -d. */
export const negate = d => dist(-(d.min + d.p.length - 1), d.p.slice().reverse(), d);

/** The distribution of the larger (or smaller) of independent a and b. */
export function extreme(a, b, larger = true) {
  const min = Math.min(a.min, b.min);
  const max = Math.max(a.min + a.p.length, b.min + b.p.length) - 1;
  const cdf = d => {
    const c = new Float64Array(max - min + 1);
    let run = 0;
    for ( let v = min; v <= max; v++ ) {
      const i = v - d.min;
      if ( (i >= 0) && (i < d.p.length) ) run += d.p[i];
      c[v - min] = Math.min(run, 1);
    }
    return c;
  };
  const ca = cdf(a);
  const cb = cdf(b);
  const p = new Float64Array(max - min + 1);
  let previous = 0;
  for ( let i = 0; i < p.length; i++ ) {
    // P(max <= v) = Fa·Fb; P(min <= v) = 1 - (1-Fa)(1-Fb).
    const c = larger ? ca[i] * cb[i] : 1 - ((1 - ca[i]) * (1 - cb[i]));
    p[i] = Math.max(c - previous, 0);
    previous = c;
  }
  return trim(dist(min, p, merge(a, b)));
}

/** Drop zero-chance totals from both ends. */
function trim(d) {
  let start = 0;
  let end = d.p.length;
  while ( (start < end - 1) && (d.p[start] < 1e-15) ) start++;
  while ( (end - 1 > start) && (d.p[end - 1] < 1e-15) ) end--;
  if ( (start === 0) && (end === d.p.length) ) return d;
  return dist(d.min + start, d.p.slice(start, end), d);
}

/**
 * The sum of the highest (or lowest) k of n fair dice of the given faces, exactly.
 *
 * Works down through the face values, choosing how many of the n dice show each one: the dice
 * showing a value are as likely as C(remaining, c)·(1/faces)^c says, and as many of them as still
 * fit among the kept k add to the total. Lowest-k is the same thing with the faces reversed.
 * @returns {Distribution|null} null when that would take too many steps.
 */
export function keepDistribution(faces, n, k, highest = true) {
  k = Math.min(k, n);
  if ( (k <= 0) || (typeof faces !== "number") ) return null;
  const span = (k * faces) + 1;
  if ( faces * n * n * span > MAX_EXACT_KEEP_WORK ) return null;
  const binom = binomials(n);
  // ways[j][t]: weight of having placed j dice with t kept so far.
  let ways = Array.from({ length: n + 1 }, () => new Float64Array(span));
  ways[0][0] = 1;
  for ( let step = 0; step < faces; step++ ) {
    const value = highest ? faces - step : step + 1;
    const next = Array.from({ length: n + 1 }, () => new Float64Array(span));
    for ( let j = 0; j <= n; j++ ) {
      const row = ways[j];
      const keptSoFar = Math.min(j, k);
      for ( let t = 0; t < span; t++ ) {
        const w = row[t];
        if ( !w ) continue;
        for ( let c = 0; c <= n - j; c++ ) {
          const added = Math.min(c, k - keptSoFar) * value;
          next[j + c][t + added] += w * binom[n - j][c];
        }
      }
    }
    ways = next;
  }
  const total = faces ** n;
  const p = ways[n].map(w => w / total);
  return trim(dist(0, p));
}

function binomials(n) {
  const rows = [Float64Array.of(1)];
  for ( let i = 1; i <= n; i++ ) {
    const row = new Float64Array(i + 1);
    row[0] = row[i] = 1;
    for ( let j = 1; j < i; j++ ) row[j] = rows[i - 1][j - 1] + rows[i - 1][j];
    rows.push(row);
  }
  return rows;
}

/* -------------------------------------------- */
/*  Simulation                                  */
/* -------------------------------------------- */

/** A small, fast seeded generator (mulberry32). */
function generator(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(text) {
  let h = 2166136261;
  for ( let i = 0; i < text.length; i++ ) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Turn a list of simulated totals into a distribution. */
function fromSamples(totals, unbounded) {
  let min = Infinity;
  let max = -Infinity;
  for ( const v of totals ) {
    if ( v < min ) min = v;
    if ( v > max ) max = v;
  }
  const p = new Float64Array(max - min + 1);
  for ( const v of totals ) p[v - min] += 1 / totals.length;
  return dist(min, p, { approximate: true, unbounded });
}

/**
 * Simulate one group: n dice, kept highest/lowest k, exploding or not.
 * @param {string} seedText  What the seed is made from, so the same group always gives the same result.
 */
function simulateGroup({ faces, n, keep, explode }, seedText) {
  const random = generator(hash(seedText));
  const face = () => ((faces === "F") ? Math.floor(random() * 3) - 1 : Math.floor(random() * faces) + 1);
  const totals = new Int32Array(SAMPLES);
  // Like Foundry, each explosion is a result of its own, and keeping chooses among all the results.
  const results = [];
  for ( let s = 0; s < SAMPLES; s++ ) {
    results.length = 0;
    for ( let i = 0; i < n; i++ ) {
      let r;
      let explosions = 0;
      do {
        r = face();
        results.push(r);
      } while ( explode && (r === faces) && (++explosions < MAX_EXPLOSIONS) );
    }
    if ( keep ) results.sort((a, b) => a - b);
    const kept = keep ? Math.min(keep.count, results.length) : results.length;
    const start = (keep?.type === "kh") ? results.length - kept : 0;
    let total = 0;
    for ( let i = start; i < start + kept; i++ ) total += results[i];
    totals[s] = total;
  }
  return fromSamples(totals, explode && !keep);
}

/* -------------------------------------------- */
/*  Pools                                       */
/* -------------------------------------------- */

/** The distribution of one die as written in a mode ("1d6", "1dw"): the wild die explodes. */
function modeDie(formula) {
  const term = parseDieTerm(formula);
  if ( !term ) return null;
  if ( term.faces === "w" ) return explodingDistribution(6);
  if ( typeof term.faces !== "number" && term.faces !== "F" ) return null;
  if ( term.modifiers && (term.modifiers !== "x") ) return null;
  const one = (term.modifiers === "x") ? explodingDistribution(term.faces) : dieDistribution(term.faces);
  return one && sumOf(one, term.count);
}

/**
 * One group of the pool: count dice of one kind, with its keep modifier.
 * @returns {Distribution|null} null for dice the odds can't be worked out for (a system's own dice,
 *   rerolls, success counting, …).
 */
function groupDistribution(key, count, keep, fateDice) {
  const term = parseDieTerm(key);
  if ( !term ) return null;
  const { faces, modifiers } = term;
  if ( (typeof faces !== "number") && !((faces === "F") && fateDice) ) return null;
  if ( modifiers && (modifiers !== "x") ) return null;
  const explode = modifiers === "x";
  if ( explode && ((faces === "F") || (faces < 2)) ) return null;
  const k = keep?.count > 0 ? keep : null;
  // Work out the size before building anything: a d1000000000 must not allocate its faces.
  const width = (faces === "F") ? 3 : faces;
  if ( !k && ((width * count) <= MAX_SPAN) ) {
    const one = explode ? explodingDistribution(faces) : dieDistribution(faces);
    if ( (one.p.length * count) <= MAX_SPAN ) return sumOf(one, count);
  } else if ( k && !explode && (faces !== "F") && ((width * k.count) <= MAX_SPAN) ) {
    const exact = keepDistribution(faces, count, k.count, k.type === "kh");
    if ( exact ) return exact;
  }
  return simulateGroup({ faces, n: count, keep: k, explode }, `${count}${key}${k ? k.type + k.count : ""}`);
}

/**
 * The distribution of a whole pool, built the same way the tray builds its formula.
 * @param {{pool: string[], mode: string, modifier: number, keep: object}} state
 * @param {object} [options]
 * @param {Record<string, object>} [options.modes]  The system's modes.
 * @param {boolean} [options.fateDice]  Whether dF is the core Fate die (-1/0/+1). Some systems use
 *   the letter for a die of their own, such as Star Wars FFG's Force die.
 * @returns {Distribution|null} null for an empty pool, or one with dice the odds can't cover.
 */
export function poolDistribution({ pool, mode, modifier, keep }, { modes = {}, fateDice = true } = {}) {
  if ( !pool.length ) return null;
  const groups = getDiceGroups(pool);
  const active = modes[mode];
  let total = null;
  for ( const [key, count] of Object.entries(groups) ) {
    let d = groupDistribution(key, count, keep[key], fateDice);
    if ( !d ) return null;
    if ( active?.style === "repeat" ) d = extreme(d, d, active.keep !== "kl");
    else if ( active?.style === "wildDie" ) {
      const wild = modeDie(active.die);
      if ( !wild ) return null;
      d = extreme(d, wild, true);
    }
    // Check the width before convolving: the work is the product of the two widths.
    if ( total && ((total.p.length + d.p.length - 1) > MAX_SPAN) ) return null;
    total = total ? convolve(total, d) : d;
  }
  if ( active?.style === "extraDie" ) {
    const extra = modeDie(active.die);
    if ( !extra ) return null;
    total = convolve(total, (active.op === "-") ? negate(extra) : extra);
  }
  return shift(total, modifier || 0);
}

/**
 * The numbers the tray shows.
 * @param {Distribution} d
 * @param {number|null} [target]  A total to reach (a DC); its chance is included when given.
 * @returns {{min: number, max: number, unbounded: boolean, mean: number, chance: number|null, approximate: boolean}}
 */
export function summarise(d, target = null) {
  let mean = 0;
  let atLeast = 0;
  for ( let i = 0; i < d.p.length; i++ ) {
    const value = d.min + i;
    mean += value * d.p[i];
    if ( (target !== null) && (value >= target) ) atLeast += d.p[i];
  }
  return {
    min: d.min,
    max: d.min + d.p.length - 1,
    unbounded: d.unbounded,
    mean,
    chance: (target === null) ? null : Math.min(Math.max(atLeast, 0), 1),
    approximate: d.approximate
  };
}

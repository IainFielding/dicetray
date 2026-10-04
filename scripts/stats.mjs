/**
 * Roll statistics: what each player has rolled, kept as fixed-size counters.
 *
 * Pure, so it can be unit-tested. Nothing grows with the number of rolls: per die size there is a
 * count, a sum and a tally of each face, and the same again for each of the most recent days.
 *
 * @typedef {object} DieTally
 * @property {number} count   Dice of this size rolled.
 * @property {number} sum     Their total.
 * @property {number[]} faces faces[i] is how often face i + 1 came up.
 *
 * @typedef {object} Stats
 * @property {number} version
 * @property {number} rolls                  Chat messages with rolls.
 * @property {Record<string, DieTally>} dice By number of faces.
 * @property {Record<string, {rolls: number, dice: Record<string, DieTally>}>} days  By "YYYY-MM-DD".
 */

export const STATS_VERSION = 1;

/** Days of per-day statistics kept; older days drop off. */
export const DAYS_KEPT = 30;

/** Dice larger than this aren't tallied face by face (a d1000 would need a thousand counters). */
export const MAX_FACES = 100;

/** @returns {Stats} */
export const emptyStats = () => ({ version: STATS_VERSION, rolls: 0, dice: {}, days: {} });

/**
 * The day a roll belongs to, as "YYYY-MM-DD" in UTC. Every player's rolls are filed by the same
 * clock, so "today" means the same day for a GM and players in different time zones.
 */
export function dayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

/** A stored value, cleaned up: anything malformed becomes empty rather than breaking the totals. */
export function normaliseStats(data) {
  if ( !data || (typeof data !== "object") || (data.version !== STATS_VERSION) ) return emptyStats();
  const tallies = dice => Object.fromEntries(Object.entries(dice ?? {}).filter(([faces, t]) => {
    const f = Number(faces);
    return Number.isInteger(f) && (f >= 2) && (f <= MAX_FACES) && Array.isArray(t?.faces) && (t.faces.length === f);
  }));
  const days = Object.fromEntries(Object.entries(data.days ?? {})
    .filter(([day]) => /^\d{4}-\d{2}-\d{2}$/.test(day))
    .map(([day, d]) => [day, { rolls: Number(d?.rolls) || 0, dice: tallies(d?.dice) }]));
  return { version: STATS_VERSION, rolls: Number(data.rolls) || 0, dice: tallies(data.dice), days };
}

function addToTallies(tallies, faces, results) {
  const tally = (tallies[faces] ??= { count: 0, sum: 0, faces: new Array(faces).fill(0) });
  for ( const r of results ) {
    tally.count++;
    tally.sum += r;
    tally.faces[r - 1]++;
  }
}

/**
 * Record one chat message's dice.
 * @param {Stats} stats  Changed in place.
 * @param {{faces: number, results: number[]}[]} dice  Each die term: its size, and every result
 *   rolled for it (including dice later dropped or rerolled — they were still rolled).
 * @param {string} day   dayKey() of the roll.
 * @returns {Stats}
 */
export function recordRoll(stats, dice, day) {
  const counted = dice
    .filter(d => Number.isInteger(d.faces) && (d.faces >= 2) && (d.faces <= MAX_FACES))
    .map(d => ({ faces: d.faces, results: d.results.filter(r => Number.isInteger(r) && (r >= 1) && (r <= d.faces)) }))
    .filter(d => d.results.length);
  if ( !counted.length ) return stats;
  const today = (stats.days[day] ??= { rolls: 0, dice: {} });
  stats.rolls++;
  today.rolls++;
  for ( const { faces, results } of counted ) {
    addToTallies(stats.dice, faces, results);
    addToTallies(today.dice, faces, results);
  }
  return stats;
}

function mergeTallies(into, from) {
  for ( const [faces, t] of Object.entries(from) ) {
    const target = (into[faces] ??= { count: 0, sum: 0, faces: new Array(Number(faces)).fill(0) });
    target.count += t.count;
    target.sum += t.sum;
    t.faces.forEach((n, i) => { target.faces[i] += n; });
  }
}

/**
 * Add `delta` (rolls not yet saved) to `stats` (what is saved), keeping only the latest days.
 * @returns {Stats} A new object; neither argument is changed.
 */
export function mergeStats(stats, delta) {
  const merged = structuredClone(normaliseStats(stats));
  merged.rolls += delta.rolls;
  mergeTallies(merged.dice, delta.dice);
  for ( const [day, d] of Object.entries(delta.days) ) {
    const target = (merged.days[day] ??= { rolls: 0, dice: {} });
    target.rolls += d.rolls;
    mergeTallies(target.dice, d.dice);
  }
  const keep = Object.keys(merged.days).sort().slice(-DAYS_KEPT);
  merged.days = Object.fromEntries(keep.map(day => [day, merged.days[day]]));
  return merged;
}

/**
 * Add several players' statistics together, e.g. for the whole party.
 * @param {Stats[]} list
 * @returns {Stats}
 */
export const combineStats = list => list.reduce((all, s) => mergeStats(all, normaliseStats(s)), emptyStats());

/**
 * The figures shown for one player (or the party), over all time or one day.
 * @param {Stats} stats
 * @param {string|null} [day]  A dayKey() for that day only; null for all time.
 */
export function summariseStats(stats, day = null) {
  const section = day ? (stats.days[day] ?? { rolls: 0, dice: {} }) : stats;
  const d20 = section.dice[20];
  const dice = Object.entries(section.dice)
    .map(([faces, t]) => ({
      faces: Number(faces),
      count: t.count,
      mean: t.count ? t.sum / t.count : null,
      expected: (Number(faces) + 1) / 2
    }))
    .sort((a, b) => a.faces - b.faces);
  return {
    rolls: section.rolls,
    d20: {
      count: d20?.count ?? 0,
      mean: d20?.count ? d20.sum / d20.count : null,
      nat20: d20?.faces[19] ?? 0,
      nat1: d20?.faces[0] ?? 0,
      faces: d20?.faces ?? new Array(20).fill(0)
    },
    dice
  };
}

/**
 * Pull the numbered dice out of rolls as plain data: each die term's size and every result rolled.
 * Other dice — Fate dice, coins, a system's own narrative dice — aren't numbered 1 to N, so they
 * aren't counted.
 * @param {{dice: {denomination: string, faces: number, results: {result: number}[]}[]}[]} rolls  Foundry Rolls.
 */
export function diceFromRolls(rolls) {
  return rolls.flatMap(roll => (roll.dice ?? [])
    // The class's DENOMINATION is "d" for numbered dice ("f" Fate, "c" coin, …); an instance's own
    // `denomination` includes the faces ("d20"), so it's only the fallback for plain data.
    .filter(term => (term.constructor?.DENOMINATION ?? term.denomination ?? "d") === "d")
    .map(term => ({ faces: term.faces, results: (term.results ?? []).map(r => r.result) })));
}

import { MODULE_ID } from "./constants.mjs";
import { dayKey, diceFromRolls, emptyStats, mergeStats, normaliseStats, recordRoll } from "./stats.mjs";

/** Flag on each User holding their statistics. */
export const STATS_FLAG = "stats";

/** Operation option carrying the token of the client making a message, so it is counted once. */
const STATS_TOKEN = `${MODULE_ID}.statsToken`;

/** Rolls are saved in batches, at most this often, rather than one database write per roll. */
const SAVE_DELAY_MS = 3000;

/** Rolls made since the last save. */
let pending = null;
let timer = null;

/** The save in progress, if any. Saves run one after another so none overwrites another. */
let saving = null;

/**
 * Messages this client is making, by the token it gave them, with their dice. Counted when the
 * message is created; a message cancelled before then is never counted. Bounded, so tokens of
 * cancelled messages can't pile up.
 */
const making = new Map();
const MAX_MAKING = 100;

/** The current reset generation: a GM reset moves it on, which makes older figures count as empty. */
export const currentEpoch = () => game.settings.get(MODULE_ID, "statsEpoch") ?? 0;

/**
 * preCreateChatMessage: this client is making a message. Pre-create hooks run only on the client
 * making it, so tagging it here means it is counted once, by this client, even with the same user
 * logged in twice. The token rides in the operation's options, so nothing is saved on the message.
 *
 * Only rolls everyone could see are counted. A blind roll is hidden from its own roller, and a
 * whispered, GM-only or self roll from the others; statistics, which every client receives, would
 * give the result away.
 */
export function onPreCreateChatMessage(message, options) {
  if ( message.blind || message.whisper?.length || !message.rolls?.length ) return;
  if ( !game.settings.get(MODULE_ID, "trackStats") ) return;
  const dice = diceFromRolls(message.rolls);
  if ( !dice.length ) return;
  const token = foundry.utils.randomID();
  options[STATS_TOKEN] = token;
  making.set(token, dice);
  if ( making.size > MAX_MAKING ) making.delete(making.keys().next().value);
}

/** createChatMessage: a message this client tagged now exists, so its dice count. */
export function onCreateChatMessage(_message, options) {
  const token = options?.[STATS_TOKEN];
  const dice = token && making.get(token);
  if ( !dice ) return;
  making.delete(token);
  const epoch = currentEpoch();
  if ( pending && (pending.epoch !== epoch) ) pending = null;
  pending ??= emptyStats(epoch);
  recordRoll(pending, dice, dayKey());
  if ( !timer ) timer = setTimeout(saveStats, SAVE_DELAY_MS);
}

/** Write the rolls made since the last save to this user's statistics. */
export function saveStats() {
  if ( timer ) clearTimeout(timer);
  timer = null;
  // Each save waits for the one before. Only the latest clears the chain, so an earlier one
  // finishing can't let a new save start alongside one still queued.
  const next = (saving ?? Promise.resolve()).then(saveNow);
  saving = next;
  next.finally(() => {
    if ( saving === next ) saving = null;
  });
  return next;
}

/**
 * One save: read this user's figures, add the new rolls, write the result back. Two clients of the
 * same user saving within the same moment can still overwrite each other's batch — Foundry has no
 * way to add to a stored number atomically — but each client saves its own batch at most every few
 * seconds, so the window is small.
 */
async function saveNow() {
  if ( !pending ) return;
  const delta = pending;
  pending = null;
  const epoch = currentEpoch();
  if ( delta.epoch !== epoch ) return;                          // made before a reset
  const stored = game.user.getFlag(MODULE_ID, STATS_FLAG);
  const merged = mergeStats(stored, delta, epoch);
  try {
    await game.user.update(statsUpdate(stored, merged, delta, epoch));
  } catch ( err ) {
    // Keep the rolls for the next save rather than losing them.
    pending = pending ? mergeStats(delta, pending, epoch) : delta;
    console.error(`${MODULE_ID} | Could not save roll statistics:`, err);
  }
}

/**
 * The User update that stores `merged`. Every client receives each update, so only what changed is
 * sent: the totals, the die sizes and days just rolled, and deletions for days that dropped off.
 * Figures from before a reset, or in an older shape, are replaced outright.
 */
function statsUpdate(stored, merged, delta, epoch) {
  const base = `flags.${MODULE_ID}.${STATS_FLAG}`;
  const { ForcedDeletion, ForcedReplacement } = foundry.data.operators;
  if ( !stored || ((Number(stored.epoch) || 0) !== epoch) || (stored.version !== merged.version) ) {
    return { [base]: ForcedReplacement.create(merged) };
  }
  const update = { [`${base}.version`]: merged.version, [`${base}.epoch`]: epoch, [`${base}.rolls`]: merged.rolls };
  for ( const faces of Object.keys(delta.dice) ) update[`${base}.dice.${faces}`] = merged.dice[faces];
  for ( const day of Object.keys(delta.days) ) {
    if ( merged.days[day] ) update[`${base}.days.${day}`] = ForcedReplacement.create(merged.days[day]);
  }
  for ( const day of Object.keys(stored.days ?? {}) ) {
    if ( !merged.days[day] ) update[`${base}.days.${day}`] = ForcedDeletion.create();
  }
  return update;
}

/** Whether the current user may see a user's statistics under "Who Sees Roll Statistics". */
export function canSeeStats(user) {
  return game.user.isGM || (user === game.user) || (game.settings.get(MODULE_ID, "statsVisibility") === "all");
}

/**
 * A user's statistics as they stand, including this client's rolls not saved yet.
 * @param {User} user
 */
export function statsFor(user) {
  const epoch = currentEpoch();
  const saved = normaliseStats(user.getFlag(MODULE_ID, STATS_FLAG), epoch);
  return ((user === game.user) && (pending?.epoch === epoch)) ? mergeStats(saved, pending, epoch) : saved;
}

/**
 * Clear everyone's statistics. GM only. The reset generation moves on first, so a player's save
 * already on its way writes figures that count as empty, rather than bringing the old totals back.
 */
export async function resetStats() {
  if ( !game.user.isGM ) return;
  await game.settings.set(MODULE_ID, "statsEpoch", currentEpoch() + 1);
  const users = game.users.filter(u => u.getFlag(MODULE_ID, STATS_FLAG));
  const updates = users.map(u => ({ _id: u.id, [`flags.${MODULE_ID}.${STATS_FLAG}`]: foundry.data.operators.ForcedDeletion.create() }));
  if ( updates.length ) await getDocumentClass("User").updateDocuments(updates);
}

/** Save straight away when the page is hidden or closed, so the last few rolls aren't lost. */
export function saveOnHide() {
  document.addEventListener("visibilitychange", () => {
    if ( document.visibilityState === "hidden" ) saveStats();
  });
}

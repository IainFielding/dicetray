import { MODULE_ID } from "./constants.mjs";
import { dayKey, diceFromRolls, emptyStats, mergeStats, normaliseStats, recordRoll } from "./stats.mjs";

/** Flag on each User holding their statistics. */
export const STATS_FLAG = "stats";

/** Rolls are saved in batches, at most this often, rather than one database write per roll. */
const SAVE_DELAY_MS = 3000;

/** Rolls made since the last save. */
let pending = null;
let timer = null;

/** The save in progress, if any. Saves run one after another so none overwrites another. */
let saving = null;

/**
 * Count a chat message's dice as it is made. Pre-create hooks run only on the client making the
 * message, so each roll is counted exactly once — even with the same user logged in twice. Blind
 * rolls are skipped: their results are hidden from the player who made them, and their statistics
 * would give them away.
 */
export function onPreCreateChatMessage(message) {
  if ( message.blind || !message.rolls?.length ) return;
  if ( !game.settings.get(MODULE_ID, "trackStats") ) return;
  pending ??= emptyStats();
  const before = pending.rolls;
  recordRoll(pending, diceFromRolls(message.rolls), dayKey());
  if ( (pending.rolls !== before) && !timer ) timer = setTimeout(saveStats, SAVE_DELAY_MS);
}

/** Write the rolls made since the last save to this user's statistics. */
export function saveStats() {
  if ( timer ) clearTimeout(timer);
  timer = null;
  saving = (saving ?? Promise.resolve()).then(saveNow).finally(() => { saving = null; });
  return saving;
}

async function saveNow() {
  if ( !pending ) return;
  const delta = pending;
  pending = null;
  // Read after any earlier save has landed, so this one builds on it.
  const merged = mergeStats(game.user.getFlag(MODULE_ID, STATS_FLAG), delta);
  try {
    // Replace the value outright, so days that have dropped off are really removed.
    await game.user.update({ [`flags.${MODULE_ID}.${STATS_FLAG}`]: foundry.data.operators.ForcedReplacement.create(merged) });
  } catch ( err ) {
    // Keep the rolls for the next save rather than losing them.
    pending = pending ? mergeStats(delta, pending) : delta;
    console.error(`${MODULE_ID} | Could not save roll statistics:`, err);
  }
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
  const saved = normaliseStats(user.getFlag(MODULE_ID, STATS_FLAG));
  return ((user === game.user) && pending) ? mergeStats(saved, pending) : saved;
}

/** Clear statistics: one user's, or (with no user) everyone's. GM only. */
export async function resetStats(user = null) {
  if ( !game.user.isGM ) return;
  const users = user ? [user] : game.users.filter(u => u.getFlag(MODULE_ID, STATS_FLAG));
  const updates = users.map(u => ({ _id: u.id, [`flags.${MODULE_ID}.${STATS_FLAG}`]: foundry.data.operators.ForcedDeletion.create() }));
  if ( updates.length ) await getDocumentClass("User").updateDocuments(updates);
}

/** Save straight away when the page is hidden or closed, so the last few rolls aren't lost. */
export function saveOnHide() {
  document.addEventListener("visibilitychange", () => {
    if ( document.visibilityState === "hidden" ) saveStats();
  });
}

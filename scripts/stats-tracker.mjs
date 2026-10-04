import { MODULE_ID } from "./constants.mjs";
import { dayKey, diceFromRolls, emptyStats, mergeStats, normaliseStats, recordRoll } from "./stats.mjs";

/** Flag on each User holding their statistics. */
export const STATS_FLAG = "stats";

/** Rolls are saved in batches, at most this often, rather than one database write per roll. */
const SAVE_DELAY_MS = 3000;

/** Rolls made since the last save. */
let pending = null;
let timer = null;

/**
 * Count a new chat message's dice, if this client's user made it. Every client sees every
 * message, so only the author's counts it. Blind rolls are skipped: their results are hidden from
 * the player who made them, and their statistics would give them away.
 */
export function onCreateChatMessage(message, _options, userId) {
  if ( (userId !== game.user.id) || message.blind || !message.rolls?.length ) return;
  if ( !game.settings.get(MODULE_ID, "trackStats") ) return;
  pending ??= emptyStats();
  const before = pending.rolls;
  recordRoll(pending, diceFromRolls(message.rolls), dayKey());
  if ( (pending.rolls !== before) && !timer ) timer = setTimeout(saveStats, SAVE_DELAY_MS);
}

/** Write the rolls made since the last save to this user's statistics. */
export async function saveStats() {
  if ( timer ) clearTimeout(timer);
  timer = null;
  if ( !pending ) return;
  const delta = pending;
  pending = null;
  const merged = mergeStats(game.user.getFlag(MODULE_ID, STATS_FLAG), delta);
  try {
    // Replace the value outright, so days that have dropped off are really removed.
    await game.user.update({ [`flags.${MODULE_ID}.${STATS_FLAG}`]: foundry.data.operators.ForcedReplacement.create(merged) });
  } catch ( err ) {
    console.error(`${MODULE_ID} | Could not save roll statistics:`, err);
  }
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

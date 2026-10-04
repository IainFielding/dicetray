import { MODULE_ID } from "../constants.mjs";
import { combineStats, dayKey, summariseStats } from "../stats.mjs";
import { STATS_FLAG, canSeeStats, currentEpoch, resetStats, statsFor } from "../stats-tracker.mjs";

const { ApplicationV2, DialogV2, HandlebarsApplicationMixin } = foundry.applications.api;

/** Re-render at most this often while statistics are coming in from other players. */
const REFRESH_DELAY_MS = 500;

const fixed = (n, digits = 1) => ((n === null) || (n === undefined) ? "—" : n.toFixed(digits));
const percent = (part, whole) => (whole ? `${((part / whole) * 100).toFixed(1)}%` : "—");

/**
 * The d20 results as a bar chart, with the line a fair die would average. Built from numbers only.
 * @param {number[]} faces  faces[i] is how often i + 1 came up.
 */
function d20Chart(faces) {
  const total = faces.reduce((a, b) => a + b, 0);
  const width = 400;
  const height = 120;
  const gap = 2;
  const bar = (width / 20) - gap;
  const fair = total / 20;
  const top = Math.max(...faces, fair, 1);
  const y = n => height - ((n / top) * (height - 4));
  const bars = faces.map((n, i) => {
    const kind = (i === 19) ? " nat20" : (i === 0) ? " nat1" : "";
    const x = (i * (bar + gap)) + (gap / 2);
    return `<rect class="dice-stats-bar${kind}" x="${x.toFixed(1)}" y="${y(n).toFixed(1)}" width="${bar.toFixed(1)}"
      height="${(height - y(n)).toFixed(1)}"><title>${i + 1}: ${n}</title></rect>`;
  }).join("");
  const labels = faces.map((_, i) => `<text x="${((i * (bar + gap)) + (gap / 2) + (bar / 2)).toFixed(1)}" y="${height + 12}"
    text-anchor="middle">${i + 1}</text>`).join("");
  const line = total ? `<line class="dice-stats-fair" x1="0" x2="${width}" y1="${y(fair).toFixed(1)}" y2="${y(fair).toFixed(1)}"/>` : "";
  return `<svg class="dice-stats-chart" viewBox="0 0 ${width} ${height + 16}" role="img">${bars}${line}${labels}</svg>`;
}

/**
 * Roll statistics for the world: each player's d20 luck, the party's d20 spread, and averages for
 * every die size, over all time or today.
 */
export class DiceStatsWindow extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "sogrom-dice-stats",
    classes: ["sogrom-dice-stats"],
    window: { title: "SOGROM_DICETRAY.StatsTitle", icon: "fas fa-chart-column", resizable: true },
    position: { width: 560, height: "auto" },
    actions: {
      scope: DiceStatsWindow.#onScope,
      select: DiceStatsWindow.#onSelect,
      reset: DiceStatsWindow.#onReset
    }
  };

  static PARTS = {
    main: { template: `modules/${MODULE_ID}/templates/stats.hbs` }
  };

  static #instance;

  /** Open the window, or bring it to the front. */
  static open() {
    this.#instance ??= new this();
    return this.#instance.render({ force: true });
  }

  /** "all" for all time, or "today". */
  #scope = "all";

  /** Whose figures the chart and dice table show: "party" or a user id. */
  #selected = "party";

  #hookId = null;

  #refresh = foundry.utils.debounce(() => {
    if ( this.rendered ) this.render();
  }, REFRESH_DELAY_MS);

  /** The users whose statistics this user may see. */
  #visibleUsers() {
    return game.users.filter(u => canSeeStats(u) && (u.getFlag(MODULE_ID, STATS_FLAG) || (u === game.user)));
  }

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const day = (this.#scope === "today") ? dayKey() : null;
    const users = this.#visibleUsers();
    const all = new Map(users.map(u => [u.id, statsFor(u)]));

    context.players = users.map(u => {
      const s = summariseStats(all.get(u.id), day);
      return {
        id: u.id,
        name: u.name,
        color: u.color?.css ?? "#999",
        rolls: s.rolls,
        d20s: s.d20.count,
        mean: fixed(s.d20.mean),
        luck: (s.d20.mean === null) ? "" : (s.d20.mean >= 10.5) ? "hot" : "cold",
        nat20: s.d20.nat20,
        nat20Rate: percent(s.d20.nat20, s.d20.count),
        nat1: s.d20.nat1,
        nat1Rate: percent(s.d20.nat1, s.d20.count),
        selected: this.#selected === u.id,
        meanValue: s.d20.mean
      };
    }).sort((a, b) => b.d20s - a.d20s);

    if ( (this.#selected !== "party") && !all.has(this.#selected) ) this.#selected = "party";
    const chosen = (this.#selected === "party") ? combineStats([...all.values()], currentEpoch()) : all.get(this.#selected);
    const summary = summariseStats(chosen, day);
    context.selectedName = (this.#selected === "party")
      ? game.i18n.localize("SOGROM_DICETRAY.StatsParty") : game.users.get(this.#selected)?.name;
    context.partySelected = this.#selected === "party";
    context.chart = summary.d20.count ? d20Chart(summary.d20.faces) : null;
    context.d20 = { count: summary.d20.count, mean: fixed(summary.d20.mean) };
    context.dice = summary.dice.map(d => ({
      name: `d${d.faces}`, count: d.count, mean: fixed(d.mean, 2), expected: fixed(d.expected, 1),
      diff: (d.mean === null) ? "" : ((d.mean - d.expected) >= 0 ? "+" : "") + (d.mean - d.expected).toFixed(2)
    }));

    const ranked = context.players.filter(p => p.d20s >= 10);
    const luckiest = ranked.reduce((best, p) => (!best || (p.meanValue > best.meanValue) ? p : best), null);
    context.luckiest = (ranked.length > 1) ? luckiest : null;
    context.scopeAll = this.#scope === "all";
    context.canReset = game.user.isGM;
    context.tracking = game.settings.get(MODULE_ID, "trackStats");
    context.empty = !context.players.some(p => p.rolls);
    return context;
  }

  /** @override */
  _onFirstRender(context, options) {
    super._onFirstRender(context, options);
    // Statistics are saved to each user's flags, so a user update is new figures arriving.
    this.#hookId = Hooks.on("updateUser", (_user, changes) => {
      if ( foundry.utils.hasProperty(changes, `flags.${MODULE_ID}`) ) this.#refresh();
    });
  }

  /** @override */
  _onClose(options) {
    super._onClose(options);
    if ( this.#hookId !== null ) Hooks.off("updateUser", this.#hookId);
    this.#hookId = null;
    DiceStatsWindow.#instance = null;
  }

  static #onScope(_event, target) {
    this.#scope = target.dataset.scope;
    this.render();
  }

  static #onSelect(_event, target) {
    this.#selected = target.dataset.user || "party";
    this.render();
  }

  static async #onReset() {
    const confirmed = await DialogV2.confirm({
      window: { title: "SOGROM_DICETRAY.StatsReset" },
      content: `<p>${game.i18n.localize("SOGROM_DICETRAY.StatsResetConfirm")}</p>`
    });
    if ( !confirmed ) return;
    await resetStats();
    this.render();
  }
}

/**
 * What the module settings' Statistics button opens. Settings menus construct a fresh application
 * each time; this one just brings up the single statistics window instead.
 */
export class DiceStatsMenu extends ApplicationV2 {
  /** @override */
  render() {
    return DiceStatsWindow.open();
  }
}

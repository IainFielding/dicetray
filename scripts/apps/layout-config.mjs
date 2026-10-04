import { ICON_PATH, MODULE_ID, t } from "../constants.mjs";
import {
  EXTRA_DICE, STANDARD_DICE, buttonImage, buttonText, cssUrl, diceButtons, normaliseButton, normaliseRows
} from "../dice.mjs";
import { defaultRows, getRows } from "../layout.mjs";

const { ApplicationV2, DialogV2, HandlebarsApplicationMixin } = foundry.applications.api;

/** More than this and the buttons get too small to hit in the sidebar. */
const MAX_PER_ROW = 10;
const MAX_ROWS = 6;
const MAX_PER_DRAWER = 10;

/** Dropping on the middle of a button, between these fractions of its width, puts it in the drawer. */
const DRAWER_ZONE = [0.3, 0.7];

const escape = value => foundry.utils.escapeHTML(value ?? "");

/** What a button looks like in the editor: the same face the tray gives it. */
function face(button) {
  const img = buttonImage(button, ICON_PATH);
  // Labels may be lang keys (from a system map); the tray localises them, so the editor does too.
  return { img, mask: img ? cssUrl(img) : null, text: game.i18n.localize(buttonText(button)), color: button.color };
}

/**
 * The GM's editor for the tray's dice layout. Changes are made to a working copy and only saved,
 * for every player, when the form is submitted.
 *
 * A button is addressed by its row and index, plus `sub` — its index in that button's drawer — when
 * it lives in a drawer.
 */
export class DiceLayoutConfig extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "sogrom-dice-layout-config",
    tag: "form",
    classes: ["sogrom-dice-layout-config"],
    window: {
      title: "SOGROM_DICETRAY.LayoutTitle",
      icon: "fas fa-dice",
      resizable: true
    },
    position: { width: 600, height: "auto" },
    form: {
      handler: DiceLayoutConfig.#onSubmit,
      closeOnSubmit: true
    },
    actions: {
      addButton: DiceLayoutConfig.#onAddButton,
      editButton: DiceLayoutConfig.#onEditButton,
      removeButton: DiceLayoutConfig.#onRemoveButton,
      addRow: DiceLayoutConfig.#onAddRow,
      addPreset: DiceLayoutConfig.#onAddPreset,
      removeRow: DiceLayoutConfig.#onRemoveRow,
      reset: DiceLayoutConfig.#onReset
    }
  };

  static PARTS = {
    form: { template: `modules/${MODULE_ID}/templates/layout-config.hbs` },
    footer: { template: "templates/generic/form-footer.hbs" }
  };

  /** The layout being edited. */
  #rows = foundry.utils.deepClone(getRows());

  /** The button being dragged: { row, index, sub? }. */
  #dragging = null;

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.rows = this.#rows.map((row, index) => ({
      index,
      label: game.i18n.format("SOGROM_DICETRAY.LayoutRow", { n: index + 1 }),
      canAdd: row.length < MAX_PER_ROW,
      buttons: row.map((button, i) => ({
        index: i,
        formula: button.formula,
        face: face(button),
        drawer: (button.drawer ?? []).map((d, sub) => ({ sub, formula: d.formula, face: face(d) }))
      }))
    }));
    context.canAddRow = this.#rows.length < MAX_ROWS;
    context.buttons = [{ type: "submit", icon: "fas fa-save", label: "SETTINGS.Save" }];
    return context;
  }

  /** @override */
  async _onFirstRender(context, options) {
    await super._onFirstRender(context, options);
    // The root element lives as long as the window, so these are added once and go with it.
    this.element.addEventListener("dragstart", this.#onDragStart.bind(this));
    this.element.addEventListener("dragover", this.#onDragOver.bind(this));
    this.element.addEventListener("dragleave", this.#onDragLeave.bind(this));
    this.element.addEventListener("drop", this.#onDrop.bind(this));
    this.element.addEventListener("dragend", this.#onDragEnd.bind(this));
    this.element.addEventListener("contextmenu", this.#onContextMenu.bind(this));
  }

  /* -------------------------------------------- */
  /*  Addressing                                  */
  /* -------------------------------------------- */

  /** Read a chip's address from its data attributes. */
  static #address(chip) {
    const sub = chip.dataset.sub;
    return { row: Number(chip.dataset.row), index: Number(chip.dataset.index), sub: (sub === undefined) ? undefined : Number(sub) };
  }

  /** The array a button lives in (a row, or a drawer) and the button itself. */
  #resolve({ row, index, sub }) {
    const top = this.#rows[row]?.[index];
    if ( sub === undefined ) return { list: this.#rows[row], button: top };
    return { list: top?.drawer, button: top?.drawer?.[sub], parent: top };
  }

  /** Take a button out of wherever it is. Empty drawers are removed. */
  #take(address) {
    const { list, button, parent } = this.#resolve(address);
    if ( !button ) return null;
    list.splice(list.indexOf(button), 1);
    if ( parent && !parent.drawer.length ) delete parent.drawer;
    return button;
  }

  /* -------------------------------------------- */
  /*  Editing                                     */
  /* -------------------------------------------- */

  /**
   * Ask for a button's details.
   * @param {object} [button]  The button to edit; omitted to create one.
   * @returns {Promise<object|null>} The cleaned button, or null if cancelled.
   */
  async #promptButton(button = {}) {
    const field = (name, label, input, hint = "") => `
      <div class="form-group">
        <label for="sogrom-dice-${name}">${t(label)}</label>
        <div class="form-fields">${input}</div>
        ${hint ? `<p class="hint">${t(hint)}</p>` : ""}
      </div>`;
    const content = `
      ${field("formula", "ButtonFormula",
        `<input id="sogrom-dice-formula" type="text" name="formula" value="${escape(button.formula)}" required
                placeholder="d6, 4dF, d6x, /r 1d20">`, "ButtonFormulaHint")}
      ${field("label", "ButtonLabel", `<input id="sogrom-dice-label" type="text" name="label" value="${escape(button.label)}">`,
        "ButtonLabelHint")}
      ${field("img", "ButtonImage", `<file-picker id="sogrom-dice-img" name="img" type="image" value="${escape(button.img)}"></file-picker>`,
        "ButtonImageHint")}
      ${field("tooltip", "ButtonTooltip",
        `<input id="sogrom-dice-tooltip" type="text" name="tooltip" value="${escape(button.tooltip)}">`)}
      ${field("color", "ButtonColor", `<color-picker id="sogrom-dice-color" name="color" value="${escape(button.color)}"></color-picker>`,
        "ButtonColorHint")}`;
    const editing = button.editing ?? !!button.formula;
    const data = await DialogV2.input({
      window: { title: editing ? "SOGROM_DICETRAY.LayoutEditButton" : "SOGROM_DICETRAY.LayoutAddButton" },
      classes: ["sogrom-dice-button-dialog"],
      content,
      ok: { label: "SOGROM_DICETRAY.LayoutApply", icon: "fas fa-check" },
      position: { width: 420 }
    });
    if ( !data ) return null;
    const cleaned = normaliseButton({ ...data, drawer: button.drawer });
    if ( cleaned ) return cleaned;
    // Ask again with what was typed, so a typo in the formula doesn't lose the rest.
    ui.notifications.error(game.i18n.format("SOGROM_DICETRAY.LayoutInvalidFormula", { formula: data.formula ?? "" }));
    return this.#promptButton({ ...data, drawer: button.drawer, editing });
  }

  static async #onAddButton(_event, target) {
    // Hold the row itself, not its number: rows may be added or removed while the dialog is open.
    const row = this.#rows[Number(target.dataset.row)];
    const button = await this.#promptButton();
    if ( !button || !row || !this.#rows.includes(row) || (row.length >= MAX_PER_ROW) ) return;
    row.push(button);
    this.render();
  }

  static async #onEditButton(_event, target) {
    const address = DiceLayoutConfig.#address(target.closest(".dice-layout-button"));
    const { list, button } = this.#resolve(address);
    if ( !button ) return;
    const edited = await this.#promptButton(button);
    // The layout may have changed while the dialog was open; only replace the same button.
    const at = list?.indexOf(button) ?? -1;
    if ( !edited || (at === -1) ) return;
    list[at] = edited;
    this.render();
  }

  static #onRemoveButton(event, target) {
    event.stopPropagation();
    if ( this.#take(DiceLayoutConfig.#address(target.closest("[data-row][data-index]"))) ) this.render();
  }

  #onContextMenu(event) {
    const chip = event.target.closest(".dice-layout-button");
    if ( !chip ) return;
    event.preventDefault();
    DiceLayoutConfig.#onRemoveButton.call(this, event, chip);
  }

  static #onAddRow() {
    if ( this.#rows.length >= MAX_ROWS ) return;
    this.#rows.push([]);
    this.render();
  }

  static #onAddPreset(_event, target) {
    if ( this.#rows.length >= MAX_ROWS ) return;
    const faces = (target.dataset.preset === "extra") ? EXTRA_DICE : STANDARD_DICE;
    this.#rows.push(normaliseRows([diceButtons(faces)])[0]);
    this.render();
  }

  static async #onRemoveRow(_event, target) {
    // Hold the row itself, not its number: rows may be removed while the dialog is open.
    const row = this.#rows[Number(target.dataset.row)];
    if ( !row ) return;
    if ( row.length ) {
      const confirmed = await DialogV2.confirm({
        window: { title: "SOGROM_DICETRAY.LayoutRemoveRow" },
        content: `<p>${t("LayoutRemoveRowConfirm")}</p>`
      });
      if ( !confirmed ) return;
    }
    const at = this.#rows.indexOf(row);
    if ( at === -1 ) return;
    this.#rows.splice(at, 1);
    this.render();
  }

  static #onReset() {
    this.#rows = normaliseRows(defaultRows());
    this.render();
  }

  /* -------------------------------------------- */
  /*  Drag and drop                               */
  /* -------------------------------------------- */

  #onDragStart(event) {
    const chip = event.target.closest?.(".dice-layout-button");
    if ( !chip ) return;
    event.stopPropagation();
    this.#dragging = DiceLayoutConfig.#address(chip);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", chip.dataset.tooltip ?? "");
    chip.classList.add("dragging");
  }

  /**
   * What a drop at this point would do:
   * - `into`: put the button in the drawer of the top-level button under the cursor
   * - `before`/`after`: put it next to the button under the cursor, in the same row or drawer
   * - `end`: put it at the end of the row under the cursor
   */
  #dropTarget(event) {
    const chip = event.target.closest?.(".dice-layout-button");
    if ( chip ) {
      const address = DiceLayoutConfig.#address(chip);
      const rect = chip.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width;
      if ( (address.sub === undefined) && (x > DRAWER_ZONE[0]) && (x < DRAWER_ZONE[1]) ) return { ...address, mode: "into", el: chip };
      return { ...address, mode: (x >= 0.5) ? "after" : "before", el: chip };
    }
    // The drawer strip under a button, between or beside its chips: into that drawer.
    const drawer = event.target.closest?.(".dice-layout-drawer");
    if ( drawer ) return { row: Number(drawer.dataset.row), index: Number(drawer.dataset.index), mode: "into", el: drawer };
    const list = event.target.closest?.(".dice-layout-buttons");
    if ( list ) return { row: Number(list.dataset.row), mode: "end", el: list };
    return null;
  }

  #clearMarkers() {
    for ( const el of this.element.querySelectorAll(".drop-before, .drop-after, .drop-into") ) {
      el.classList.remove("drop-before", "drop-after", "drop-into");
    }
  }

  #onDragOver(event) {
    if ( !this.#dragging ) return;
    const target = this.#dropTarget(event);
    if ( !target ) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    this.#clearMarkers();
    target.el.classList.add(`drop-${(target.mode === "end") ? "into" : target.mode}`);
  }

  #onDragLeave(event) {
    if ( !this.element.contains(event.relatedTarget) ) this.#clearMarkers();
  }

  /**
   * Whether a move is allowed, warning if not. Drawers are one level deep, and rows and drawers
   * have a size limit.
   */
  #canMove(from, moving, target, destination) {
    const warn = key => {
      ui.notifications.warn(game.i18n.format(key, { max: (key === "SOGROM_DICETRAY.LayoutRowFull") ? MAX_PER_ROW : MAX_PER_DRAWER }));
      return false;
    };
    const intoDrawer = (target.mode === "into") || (target.sub !== undefined);
    if ( intoDrawer && moving.drawer?.length ) return warn("SOGROM_DICETRAY.LayoutNestedDrawer");
    if ( destination === moving ) return false;
    const sameList = intoDrawer
      ? ((from.sub !== undefined) && (from.row === target.row) && (from.index === target.index))
      : ((from.sub === undefined) && (from.row === target.row));
    if ( sameList ) return true;
    const size = intoDrawer ? (destination.drawer?.length ?? 0) : this.#rows[target.row].length;
    if ( size >= (intoDrawer ? MAX_PER_DRAWER : MAX_PER_ROW) ) return warn(intoDrawer ? "SOGROM_DICETRAY.LayoutDrawerFull" : "SOGROM_DICETRAY.LayoutRowFull");
    return true;
  }

  #onDrop(event) {
    if ( !this.#dragging ) return;
    const target = this.#dropTarget(event);
    if ( !target ) return;
    event.preventDefault();
    const from = this.#dragging;
    this.#dragging = null;

    const { button: moving } = this.#resolve(from);
    // Resolve what the drop refers to *before* moving anything, then place relative to those
    // objects, so taking the button out first can't shift the destination under it.
    const reference = (target.mode === "end") ? null : this.#resolve(target);
    const destination = (target.mode === "into") ? reference.button : reference?.parent ?? null;
    if ( !moving || (reference?.button === moving) ) return this.render();
    if ( !this.#canMove(from, moving, target, destination ?? reference?.button) ) return this.render();

    this.#take(from);
    if ( target.mode === "end" ) this.#rows[target.row].push(moving);
    else if ( target.mode === "into" ) (reference.button.drawer ??= []).push(moving);
    else {
      const list = (target.sub === undefined) ? this.#rows[target.row] : (reference.parent.drawer ??= []);
      const at = list.indexOf(reference.button);
      list.splice((at === -1) ? list.length : at + ((target.mode === "after") ? 1 : 0), 0, moving);
    }
    this.render();
  }

  #onDragEnd() {
    this.#dragging = null;
    this.#clearMarkers();
    for ( const el of this.element.querySelectorAll(".dragging") ) el.classList.remove("dragging");
  }

  /* -------------------------------------------- */
  /*  Saving                                      */
  /* -------------------------------------------- */

  static async #onSubmit() {
    const rows = normaliseRows(this.#rows);
    // Saving exactly the default layout stores nothing, so the world keeps following the default.
    const isDefault = JSON.stringify(rows) === JSON.stringify(normaliseRows(defaultRows()));
    await game.settings.set(MODULE_ID, "diceRows", isDefault ? [] : rows);
  }
}

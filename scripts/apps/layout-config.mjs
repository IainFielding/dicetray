import { ICON_PATH, MODULE_ID } from "../constants.mjs";
import {
  EXTRA_DICE, STANDARD_DICE, buttonImage, buttonText, diceButtons, normaliseButton, normaliseRows
} from "../dice.mjs";
import { defaultRows, getRows } from "../layout.mjs";

const { ApplicationV2, DialogV2, HandlebarsApplicationMixin } = foundry.applications.api;

/** More than this and the buttons get too small to hit in the sidebar. */
const MAX_PER_ROW = 10;
const MAX_ROWS = 6;

const t = key => game.i18n.localize(`SOGROM_DICETRAY.${key}`);
const escape = value => foundry.utils.escapeHTML(value ?? "");

/** What a button looks like in the editor: the same face the tray gives it. */
function face(button) {
  const img = buttonImage(button, ICON_PATH);
  return { img, mask: img ? encodeURI(img) : null, text: buttonText(button), color: button.color };
}

/**
 * The GM's editor for the tray's dice layout. Changes are made to a working copy and only saved,
 * for every player, when the form is submitted.
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

  /** The button being dragged: { row, index }. */
  #dragging = null;

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.rows = this.#rows.map((row, index) => ({
      index,
      label: game.i18n.format("SOGROM_DICETRAY.LayoutRow", { n: index + 1 }),
      canAdd: row.length < MAX_PER_ROW,
      buttons: row.map((button, i) => ({ index: i, formula: button.formula, face: face(button) }))
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
  /*  Editing                                     */
  /* -------------------------------------------- */

  /** Find the button a target refers to, from its data-row and data-index. */
  #locate(target) {
    const row = Number(target.closest("[data-row]")?.dataset.row);
    const index = Number(target.closest("[data-index]")?.dataset.index);
    return { row, index, button: this.#rows[row]?.[index] };
  }

  /**
   * Ask for a button's details.
   * @param {object} [button]  The button to edit; omitted to create one.
   * @returns {Promise<object|null>} The cleaned button, or null if cancelled or invalid.
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
    const data = await DialogV2.input({
      window: {
        title: (button.editing ?? !!button.formula) ? "SOGROM_DICETRAY.LayoutEditButton" : "SOGROM_DICETRAY.LayoutAddButton"
      },
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
    return this.#promptButton({ ...data, drawer: button.drawer, editing: button.editing ?? !!button.formula });
  }

  static async #onAddButton(_event, target) {
    const row = Number(target.dataset.row);
    const button = await this.#promptButton();
    if ( !button || !this.#rows[row] || (this.#rows[row].length >= MAX_PER_ROW) ) return;
    this.#rows[row].push(button);
    this.render();
  }

  static async #onEditButton(_event, target) {
    const { row, index, button } = this.#locate(target);
    if ( !button ) return;
    const edited = await this.#promptButton(button);
    if ( !edited || (this.#rows[row]?.[index] !== button) ) return;
    this.#rows[row][index] = edited;
    this.render();
  }

  static #onRemoveButton(event, target) {
    event.stopPropagation();
    const { row, index, button } = this.#locate(target);
    if ( !button ) return;
    this.#rows[row].splice(index, 1);
    this.render();
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
    const row = Number(target.dataset.row);
    if ( !this.#rows[row] ) return;
    if ( this.#rows[row].length ) {
      const confirmed = await DialogV2.confirm({
        window: { title: "SOGROM_DICETRAY.LayoutRemoveRow" },
        content: `<p>${t("LayoutRemoveRowConfirm")}</p>`
      });
      if ( !confirmed ) return;
    }
    this.#rows.splice(row, 1);
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
    this.#dragging = { row: Number(chip.dataset.row), index: Number(chip.dataset.index) };
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", chip.dataset.tooltip ?? "");
    chip.classList.add("dragging");
  }

  /** Where a drop at this point would put the button: { row, index } and the element to mark. */
  #dropTarget(event) {
    const chip = event.target.closest?.(".dice-layout-button");
    if ( chip ) {
      const rect = chip.getBoundingClientRect();
      const after = event.clientX > rect.left + (rect.width / 2);
      return { row: Number(chip.dataset.row), index: Number(chip.dataset.index) + (after ? 1 : 0), chip, after };
    }
    const list = event.target.closest?.(".dice-layout-buttons");
    if ( list ) return { row: Number(list.dataset.row), index: this.#rows[Number(list.dataset.row)]?.length ?? 0, list };
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
    if ( target.chip ) target.chip.classList.add(target.after ? "drop-after" : "drop-before");
    else target.list.classList.add("drop-into");
  }

  #onDragLeave(event) {
    if ( !this.element.contains(event.relatedTarget) ) this.#clearMarkers();
  }

  #onDrop(event) {
    if ( !this.#dragging ) return;
    const target = this.#dropTarget(event);
    if ( !target ) return;
    event.preventDefault();
    const from = this.#dragging;
    this.#dragging = null;
    let { row, index } = target;
    if ( (row !== from.row) && (this.#rows[row].length >= MAX_PER_ROW) ) {
      ui.notifications.warn(game.i18n.format("SOGROM_DICETRAY.LayoutRowFull", { max: MAX_PER_ROW }));
      return this.render();
    }
    const [button] = this.#rows[from.row].splice(from.index, 1);
    // Removing it first shifts everything after it in the same row one place left.
    if ( (row === from.row) && (index > from.index) ) index--;
    this.#rows[row].splice(index, 0, button);
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

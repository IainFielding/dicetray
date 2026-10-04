import { MODULE_ID } from "./constants.mjs";
import { rollPool } from "./roll.mjs";
import { clearPool } from "./state.mjs";
import { DiceTrayWindow } from "./popout.mjs";
import { toggleTrayVisible } from "./tray.mjs";

/**
 * Keyboard shortcuts, configured under Game Settings → Configure Controls. None has a default
 * key: almost every free combination is taken by some other module, and a clash is worse than an
 * unbound shortcut the player can set once.
 */
export function registerKeybindings() {
  const bindings = {
    toggleTray: {
      name: "SOGROM_DICETRAY.KeybindingToggleTray",
      hint: "SOGROM_DICETRAY.KeybindingToggleTrayHint",
      run: () => { toggleTrayVisible(); }
    },
    togglePopout: {
      name: "SOGROM_DICETRAY.KeybindingTogglePopout",
      hint: "SOGROM_DICETRAY.KeybindingTogglePopoutHint",
      run: () => { DiceTrayWindow.toggle(); }
    },
    rollPool: {
      name: "SOGROM_DICETRAY.KeybindingRollPool",
      hint: "SOGROM_DICETRAY.KeybindingRollPoolHint",
      run: () => { rollPool(); }
    },
    clearPool: {
      name: "SOGROM_DICETRAY.KeybindingClearPool",
      hint: "SOGROM_DICETRAY.KeybindingClearPoolHint",
      run: () => clearPool()
    }
  };
  for ( const [action, { name, hint, run }] of Object.entries(bindings) ) {
    game.keybindings.register(MODULE_ID, action, {
      name,
      hint,
      editable: [],
      onDown: () => {
        run();
        return true;
      },
      precedence: CONST.KEYBINDING_PRECEDENCE.NORMAL
    });
  }
}

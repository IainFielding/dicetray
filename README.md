![](https://img.shields.io/badge/Foundry-v14-informational)
<!--- ![Latest Release Download Count](https://img.shields.io/github/downloads/IainFielding/dicetray/latest/module.zip) -->
<!--- ![Forge Installs](https://img.shields.io/badge/dynamic/json?label=Forge%20Installs&query=package.installs&suffix=%25&url=https%3A%2F%2Fforge-vtt.com%2Fapi%2Fbazaar%2Fpackage%2Fsogrom-dicetray&colorB=4aa94a) -->

# Sogrom's Dice Tray

A Foundry VTT module that adds a convenient dice tray to the chat sidebar for quickly building and rolling dice pools with advantage, disadvantage, and keep highest/lowest support.

![Dice Tray Overview](https://github.com/IainFielding/dicetray/blob/master/assets/docs/dicetray-screenshot.png?raw=true)

---

## Features

- Build dice pools by clicking dice buttons directly in the chat sidebar
- Support for all standard dice: D4, D6, D8, D10, D12, D20, and D100
- Roll modifiers: Keep Highest, Advantage, Disadvantage, and Keep Lowest
- Live formula preview as you build your pool
- Toggle the tray on/off with a D20 button in the sidebar header
- Works in both the sidebar and popped-out chat windows
- Visibility preference is saved per user

---

## How to Use

### Adding and Removing Dice

**Left-click** any dice button (D4–D100) to add that die to your pool. A badge appears on the button showing how many of that die you've added.

**Right-click** a dice button to remove one die of that type from the pool.


![Dice Buttons](https://github.com/IainFielding/dicetray/blob/master/assets/docs/dice-buttons.png?raw=true)

### Roll Modifiers

The tray provides four roll modifier modes. Only one can be active at a time — click a mode to select it, click it again to deselect and return to a normal roll.

| Button | Mode | Effect |
|--------|------|--------|
| **KH** | Keep Highest | Rolls the pool and keeps only the highest result from each die group (e.g. `2d20kh`) |
| **ADV** | Advantage | Rolls with advantage — doubles the dice and keeps the better half (e.g. `2d20adv`) |
| **DIS** | Disadvantage | Rolls with disadvantage — doubles the dice and keeps the worse half (e.g. `2d20dis`) |
| **KL** | Keep Lowest | Rolls the pool and keeps only the lowest result from each die group (e.g. `2d20kl`) |

![Roll Modifiers](https://github.com/IainFielding/dicetray/blob/master/assets/docs/roll-modifiers.png?raw=true)

### Formula Display

As you add dice and select a mode, the formula preview updates in real time to show exactly what will be rolled (e.g. `1d8 + 2d6kh`). When the pool is empty it displays *"Click dice to add them to your pool"*.


### Rolling and Clearing

- **Roll** — Evaluates the current formula and posts the result as a chat message with a flavor label indicating the roll mode (if any).
- **Clear** — Resets the entire dice pool and deselects any active roll mode.



### Toggling the Dice Tray

A **D20 icon button** is added to the chat sidebar header (next to the export button). Click it to show or hide the dice tray. Your preference is saved per client and persists between sessions.

![DiceTray toggle](https://github.com/IainFielding/dicetray/blob/master/assets/docs/dicetray-showicon.png?raw=true)

---

## Compatibility

- **Foundry VTT**: v14+
- **Systems**: System-agnostic — works with any game system

---

## License

See [LICENSE](LICENSE) for details.


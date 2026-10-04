![](https://img.shields.io/badge/Foundry-v14-informational) ![Latest Release Download Count](https://img.shields.io/github/downloads/IainFielding/dicetray/latest/module.zip?label=Downloads) <br> <!--- [![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/M4M01JLMYA) -->
<!--- ![Latest Release Download Count](https://img.shields.io/github/downloads/IainFielding/dicetray/latest/module.zip) -->
<!--- ![Forge Installs](https://img.shields.io/badge/dynamic/json?label=Forge%20Installs&query=package.installs&suffix=%25&url=https%3A%2F%2Fforge-vtt.com%2Fapi%2Fbazaar%2Fpackage%2Fsogrom-dicetray&colorB=4aa94a) -->

# Dice Tray by Sogrom

I created this Foundry module because the exsisting dice-tray module wasn't working on V14 of Foundry, and the other alternative is a much larger module which does multiple things. I just wanted to make a simple dice roller. The original dice-calculator module was the inspiration for this module. The goal of this module is to add a dice tray to the chat sidebar for quickly building and rolling dice with support for modifiers.

![Dice Tray Overview](https://github.com/IainFielding/dicetray/blob/master/assets/docs/dicetray-screenshot.png?raw=true)


## Features

- Build dice pools by clicking dice buttons directly in the Dice Tray
- Support for all standard D&D dice: D4, D6, D8, D10, D12, D20, and D100
- A GM editor for the tray's dice: add rows, extra dice (D2–D30), Fate or exploding dice, chat commands, custom images and colours
- Roll modifiers: Keep Highest, Advantage, Disadvantage, and Keep Lowest
- Live formula preview as you build your pool
- Toggle the tray on/off with a D20 button
- Works in both the sidebar and popped-out chat windows

## How to Use

### Adding and Removing Dice
![Dice Buttons](https://github.com/IainFielding/dicetray/blob/master/assets/docs/dice-buttons.png?raw=true) 

- **Left-click** any dice button (D4–D100) to add that die to the pool. A badge appears on the button showing how many of that die are added.
- **Right-click** a dice button to remove one die of that type from the pool. In the module settings you can change **Right-click on a die** to *Roll one immediately* instead, which rolls a single die of that type without touching the pool you're building.

### Configuring the Dice (GM)

In the module settings, **Dice Layout → Configure Dice** opens an editor for the buttons every player's tray shows.

- **Add Standard Dice Row** / **Add Extra Dice Row** add a ready-made row: D4–D100, or D2, D3, D5, D7, D14, D16, D24 and D30.
- **Add Row** starts an empty row, and **+** adds a button to it.
- Click a button to edit it, drag it to move it within or between rows, and right-click it (or use its **×**) to remove it.
- **Drop a button on the middle of another** to put it in that button's **drawer**. In the tray, a small orange corner marks a button with a drawer: click it as usual, or press and hold it (or press the up arrow on it) to open its drawer of extra dice. Keep rarely used dice out of the way, such as the D100 inside the D10.
- **Reset to Default** goes back to the standard dice.

Each button has:

| Field | What it does |
|-------|--------------|
| **Formula** | What one click adds: a die (`d6`), several (`4dF` for Fate dice), or a die with modifiers (`d6x` explodes, `d10r1` rerolls 1s). A chat command starting with `/` runs straight away instead. |
| **Label** | Text shown when the button has no image. |
| **Image** | Your own image; standard dice use the built-in icons. |
| **Tooltip** | Hover text. |
| **Colour** | Tints the image, or colours the label. |

Nothing changes for players until you click **Save**.

### Dragging Dice

- **Drag a die onto the canvas** to roll it there and then. If you've added that die to the pool, its whole group rolls (with its keep modifier and roll mode) and those dice leave the pool; otherwise one click's worth is rolled. The flat modifier, and a mode that adds a die (such as Daggerheart's advantage), go with the group only when it's the whole pool; otherwise they stay for the rest of the roll.
- **Drag a die onto the macro hotbar** to keep that roll as a macro you can click any time.

### Roll Modifiers
![Roll Modifiers](https://github.com/IainFielding/dicetray/blob/master/assets/docs/roll-modifiers.png?raw=true)

The tray provides four roll modifier modes. Only one can be active at a time — click a mode to select it, click it again to deselect and return to a normal roll.

| Button | Mode | Effect |
|--------|------|--------|
| **KH** | Keep Highest | Rolls the pool and keeps only the highest result from each die group  |
| **ADV** | Advantage | Rolls with advantage — doubles the dice and keeps the better half  |
| **DIS** | Disadvantage | Rolls with disadvantage — doubles the dice and keeps the worse half  |
| **KL** | Keep Lowest | Rolls the pool and keeps only the lowest result from each die group  |

### Odds

As you build a roll, a line under the buttons shows its **average** and its **lowest–highest** total. Type a number into the **DC** box to see your chance of rolling at least that, coloured green, amber or red.

- Advantage, keep highest/lowest, exploding dice, Fate dice, the modifier and each system's own modes are all taken into account.
- The numbers are exact. For very large pools that would take too long to work out, they're estimated from simulated rolls and marked with **≈**.
- Press **Enter** in the DC box to roll. Turn the line off with **Show the Odds** in the module settings.

### Modifier

The box on the left of the controls is a flat modifier added to the roll.

- Click **+** / **−**, scroll the mouse wheel over it, or use the arrow keys, to change it by one.
- Click into it and type a number such as `5`, `+3` or `-2`.
- Press **Enter** in the box to roll straight away.

### Formula Display

As dice are added and a mode selcted, the formula preview updates in real time to show exactly what will be rolled.


### Rolling and Clearing

- **Roll** — Evaluates the current formula and posts the result as a chat message with a flavor label indicating the roll mode (if any).
- **Clear** (the eraser at the bottom left of the tray) — Resets the entire dice pool: dice, keep modifiers, roll mode and modifier.


### Toggling the Dice Tray
![DiceTray toggle](https://github.com/IainFielding/dicetray/blob/master/assets/docs/dicetray-showicon.png?raw=true)

A **D20 icon button** is added to the chat sidebar header (next to the export button). Click it to show or hide the dice tray. Your preference is saved per client and persists between sessions.

### Pop-out Tray

The tray can also open in its own window that you can move anywhere on screen. It shares the same dice pool as the sidebar tray, and shows the formula at the top, since the chat bar may be out of sight.

- Click the **Dice Tray** button in the token controls on the left of the screen to open or close it. The **Pop-out Tray Button** setting moves the button to every set of controls, or hides it.
- Turn on **Open the Pop-out Tray on Load** to have it open every time you join.
- The window remembers where you left it.

### Roll Statistics

Click the chart icon at the bottom right of the tray (or **Roll Statistics → Open Statistics** in the module settings) to see who's rolling hot and who's cursed:

- every player's rolls, d20 average against the 10.5 a fair die gives, and natural 20s and 1s
- the d20 spread for the whole party or one player, against what a fair die would give
- the average for every die size
- all time, or just today

Every roll made in chat counts, whether from the tray, a character sheet or a macro. Blind rolls don't. The GM can turn counting off (**Keep Roll Statistics**), choose whether players see each other's figures (**Who Sees Roll Statistics**), and reset everything from the window.

### Keyboard Shortcuts

Under **Game Settings → Configure Controls** you can bind keys to **Show or Hide the Dice Tray**, **Open or Close the Pop-out Tray**, **Roll the Dice Pool** and **Clear the Dice Pool**. They have no keys by default, so they never clash with another module's shortcuts.

---

## Game Systems

The tray works with any system. Some systems start with dice and roll modes that suit them; the GM can change the dice in **Configure Dice** as usual.

| System | Starting dice | Mode buttons |
|--------|---------------|--------------|
| D&D 5e | D4–D100 | **ADV / DIS** use the system's own advantage, so its chat cards recognise the roll |
| Pathfinder 2e, Starfinder 2e | D4–D100; hold the D20 for DC 5 and DC 11 flat checks | **FOR / MIS**: fortune and misfortune |
| Daggerheart | D4–D20 and **Duality**; hold it for a Hope or Fear Fate roll (the system's `/dr` and `/fr` commands) | **ADV / DIS** add or take away a d6 |
| Savage Worlds (SWADE) | D4–D12, all acing | **WILD**: rolls the Wild Die alongside and keeps the higher |
| Dungeon Crawl Classics | The full dice chain, D3–D100 | none |
| Fate | 4dF, dF and D6 | none |
| Star Wars FFG, Genesys | The narrative dice, with the system's art | none |
| Alien RPG | Base and Stress dice | none |
| Cosmere RPG | D4–D20 and the Plot die | ADV / DIS |
| Shadow of the Demon Lord | D3, D6, D20 | **BOON / BANE** add or take away a d6 |
| Anything else | D4–D100 | ADV / DIS roll twice and keep the better or worse result |

## For Developers

Modules, systems and macros can drive the tray, react to its rolls, or give a game system its own dice and mode buttons. See [docs/API.md](docs/API.md).

## Compatibility

- **Foundry VTT**: v14+
- **Systems**: any; see [Game Systems](#game-systems). Tested in play with Dungeons & Dragons 5e.

---

## License

See [LICENSE](LICENSE) for details.


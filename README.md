# Neko Survivors

A Vampire Survivors-style browser game with a cat/neko theme. Built with React + TypeScript + Vite.

**Play now:** [https://character-theme-generator-jcv2resv.devinapps.com](https://character-theme-generator-jcv2resv.devinapps.com)

Built with AI for the Xiaomi MiMo 100T Program.

## Features

### Gameplay
- Control a pixel-art cat character with WASD movement
- Auto-attack: shoot fish projectiles toward mouse cursor
- Dash with SHIFT for quick evasion (with invincibility frames)
- Fight waves of enemies: mice, rats, dogs, snakes, and boss dogs
- Level up and choose from 8 different abilities (Extra Fish, Quick Paws, Sharp Claws, Agility, Nine Lives, Piercing Fish, Cat Magnet, Fast Fish)
- HP bar, XP bar, timer, kill counter, minimap
- Slow HP regeneration
- Difficulty scaling over time

### Quest System
- 10 different quests tracking various objectives
- Quest types: kills, survive time, level reached, specific enemy kills, dash count
- Progress bars and claim buttons for completed quests
- Coin rewards for completing quests

### Store System
- 8 purchasable permanent upgrades using in-game coins
- **Tough Cat** - +10 starting max HP per level
- **Power Paws** - +3 starting damage per level
- **Swift Feet** - +10 starting speed per level
- **Fish School** - +1 starting projectile
- **Cat Nap** - +50% HP regen rate per level
- **Treasure Hunter** - +20 pickup range per level
- **Lucky Cat** - +5% coin bonus per level
- **Shadow Step** - -0.2s dash cooldown per level
- Upgrades persist across sessions via localStorage

### Options / Settings
- Toggle: Show Damage Numbers, Show Minimap, Screen Shake
- Sliders: Music Volume, SFX Volume
- Reset All Data button
- Settings persist across sessions via localStorage

### Coin Economy
- Earn coins by killing enemies (mouse = 1, dog = 2, boss = 5)
- Lucky Cat store upgrade increases coin earnings
- Claim quest rewards for bonus coins
- Spend coins in the Store for permanent upgrades

## Tech Stack
- **React 19** + **TypeScript**
- **Vite** for build tooling
- **HTML5 Canvas** for game rendering
- **localStorage** for save data persistence

## Getting Started

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Controls
| Key | Action |
|-----|--------|
| W / A / S / D | Move |
| Mouse | Aim |
| SHIFT / Space | Dash |
| ESC | Pause |

## License
MIT

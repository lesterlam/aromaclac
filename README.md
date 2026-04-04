# AromaCalc

Aromatherapy recipe calculator for creating essential oil blend formulations with dilution tracking and IFRA-compliant safety calculations.

**Live:** https://myaromaclac.netlify.app/

## Features

- **Oil Library** - Manage essential oils with aroma type, notes, dilution guidelines, IFRA certificates, and material info
- **Recipe Builder** - Create blends with batch size, dilution rate, and age group
- **Safety Calculations** - Real-time IFRA-compliant dilution warnings based on age group
- **Import/Export** - CSV and JSON for recipes and library data
- **PWA** - Works offline, installable on any device

## Tech Stack

React 18 · TypeScript · Vite · Tailwind CSS · Dexie (IndexedDB)

## Getting Started

```bash
npm install
npm run dev
```

## Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm test` | Run tests |

## Data Storage

All data stored locally in browser IndexedDB - no account required.

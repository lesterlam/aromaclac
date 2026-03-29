# AromaCalc

Essential oil recipe calculator with dilution tracking and safety alerts.
https://myaromaclac.netlify.app/

## Features

- **Base Oils**: Add and manage carrier oils with proportional parts
- **Essential Oils**: Organize by categories with drag-and-drop reordering
- **Safety Tracking**: Set max dilution percentages per oil with real-time safety alerts
- **Recipe Library**: Save and organize recipes with titles and descriptions
- **Autocomplete**: Smart suggestions from your oil library as you type
- **Data Portability**: Export/import recipes and library data via JSON backup
- **Dark Mode**: Automatic dark mode support based on system preferences

## Getting Started

```bash
npm install
npm run dev
```

## Tech Stack

- React 19 + TypeScript
- Vite
- Tailwind CSS
- Dexie (IndexedDB)
- dnd-kit (drag and drop)

## Project Structure

```
src/
├── components/      # React components
├── db/            # Database schema and migrations
├── hooks/          # Custom React hooks
├── lib/           # Export/import utilities
├── logic/         # Business logic and calculations
├── App.tsx        # Main application component
└── main.tsx       # Entry point
```

## Commands

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run preview  # Preview production build
npm test         # Run tests
```

## Data Storage

All data is stored locally in the browser using IndexedDB:
- Recipes with base oils, categories, and essential oils
- Essential oil library with saved max dilution percentages
- Base oil library
- Last opened recipe preference

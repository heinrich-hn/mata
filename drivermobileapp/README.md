# Matanuska Driver App - Vite PWA

A mobile-first Progressive Web App (PWA) for fleet drivers built with Vite + React, featuring offline support, real-time data sync, and native app-like experience.

## Features

- 📱 **Mobile-First Design**: Optimized for mobile devices with bottom navigation
- 🔐 **Secure Authentication**: Supabase Auth with protected routes
- ⚡ **Real-time Updates**: Live data sync with Supabase
- 📴 **Offline Support**: PWA with service worker caching (vite-plugin-pwa)
- 🎨 **Modern UI**: Tailwind CSS with shadcn/ui components
- 🔄 **Data Caching**: TanStack React Query for efficient data fetching

## Tech Stack

- **Build Tool**: Vite 6
- **Framework**: React 18 (react-router-dom v6)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui (Radix primitives)
- **Authentication**: Supabase Auth
- **Database**: Supabase (PostgreSQL)
- **State Management**: TanStack React Query v5
- **PWA**: vite-plugin-pwa (Workbox)

## Getting Started

### Prerequisites

- Node.js 18+
- npm
- Supabase project

### Installation

1. Navigate to the driver app directory:

   ```bash
   cd drivermobileapp
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Create environment file:

   ```bash
   cp .env.example .env
   ```

4. Update `.env` with your Supabase credentials:

   ```env
   VITE_SUPABASE_URL=your-supabase-url
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```

5. Start the development server:

   ```bash
   npm run dev
   ```

### Building for Production

```bash
npm run build
npm run preview
```

## Project Structure

```
drivermobileapp/
├── public/
│   ├── icons/              # PWA icons
│   └── manifest.json       # PWA manifest
├── src/
│   ├── App.tsx             # Routes & protected layout
│   ├── main.tsx            # Entry point, QueryClient, SW registration
│   ├── index.css           # Global styles & CSS variables
│   ├── pages/              # Page components
│   │   ├── HomePage.tsx
│   │   ├── LoginPage.tsx
│   │   ├── DieselPage.tsx
│   │   ├── ExpensesPage.tsx
│   │   ├── TripPage.tsx
│   │   ├── ProfilePage.tsx
│   │   └── DocumentsPage.tsx
│   ├── components/
│   │   ├── layout/         # MobileShell, BottomNav
│   │   └── ui/             # shadcn/ui components
│   ├── contexts/           # AuthContext
│   ├── hooks/              # Custom hooks (realtime, toast, documents)
│   ├── lib/
│   │   └── supabase/       # Supabase client (singleton)
│   └── types/              # TypeScript types
├── tailwind.config.ts
├── vite.config.ts
└── vercel.json
```

## Pages

| Route                | Description                                     |
| -------------------- | ----------------------------------------------- |
| `/`                  | Dashboard with vehicle info and recent activity  |
| `/login`             | Authentication page                              |
| `/diesel`            | Log and view diesel fill-ups                     |
| `/expenses`          | Log and view trip expenses                       |
| `/trips`             | View and manage trips                            |
| `/profile`           | User profile and settings                        |
| `/profile/documents` | Driver documents and expiry tracking             |

## PWA Installation

### iOS (Safari)

1. Open the app in Safari
2. Tap the Share button
3. Select "Add to Home Screen"

### Android (Chrome)

1. Open the app in Chrome
2. Tap the menu (three dots)
3. Select "Add to Home screen" or "Install app"

## Environment Variables

| Variable               | Description                 |
| ---------------------- | --------------------------- |
| `VITE_SUPABASE_URL`    | Your Supabase project URL   |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anonymous key |

> **Note**: These must also be set in the Vercel dashboard for production builds. The `.env` file is gitignored.

## Development

### Commands

```bash
npm run dev        # Start development server
npm run build      # Build for production
npm run preview    # Preview production build locally
npm run lint       # Run ESLint
```

## Deployment

### Vercel (Recommended)

1. Connect your GitHub repository to Vercel
2. Set `framework` to `vite` and `outputDirectory` to `dist`
3. Add environment variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`)
4. Deploy

## License

This project is proprietary to Matanuska Transport Co.

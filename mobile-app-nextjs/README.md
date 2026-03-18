# Car Craft Driver App - Next.js PWA

A modern, mobile-first Progressive Web App (PWA) for fleet drivers built with Next.js 14, featuring offline support, real-time data sync, and native app-like experience.

## Features

- 📱 **Mobile-First Design**: Optimized for mobile devices with bottom navigation
- 🔐 **Secure Authentication**: Supabase Auth with protected routes
- ⚡ **Real-time Updates**: Live data sync with Supabase
- 📴 **Offline Support**: PWA with service worker caching
- 🎨 **Modern UI**: Tailwind CSS with shadcn/ui components
- 🔄 **Data Caching**: React Query for efficient data fetching

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui (Radix primitives)
- **Authentication**: Supabase Auth
- **Database**: Supabase (PostgreSQL)
- **State Management**: TanStack React Query
- **PWA**: next-pwa

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Supabase project

### Installation

1. Clone the repository and navigate to the mobile app directory:

   ```bash
   cd mobile-app-nextjs
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Create environment file:

   ```bash
   cp .env.example .env.local
   ```

4. Update `.env.local` with your Supabase credentials:

   ```env
   NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```

5. Start the development server:

   ```bash
   npm run dev
   ```

6. Open [http://localhost:3000](http://localhost:3000) in your browser

### Building for Production

```bash
npm run build
npm start
```

## Project Structure

```
mobile-app-nextjs/
├── public/
│   ├── icons/              # PWA icons
│   └── manifest.json       # PWA manifest
├── src/
│   ├── app/                # Next.js App Router pages
│   │   ├── layout.tsx      # Root layout
│   │   ├── page.tsx        # Home page
│   │   ├── login/          # Login page
│   │   ├── diesel/         # Diesel logging
│   │   ├── freight/        # Freight logging
│   │   └── profile/        # User profile
│   ├── components/
│   │   ├── layout/         # Shell components
│   │   ├── providers.tsx   # App providers
│   │   └── ui/             # UI components
│   ├── contexts/           # React contexts
│   ├── hooks/              # Custom hooks
│   ├── lib/
│   │   ├── supabase/       # Supabase clients
│   │   └── utils.ts        # Utility functions
│   └── types/              # TypeScript types
├── middleware.ts           # Auth middleware
├── tailwind.config.ts      # Tailwind configuration
└── next.config.js          # Next.js configuration
```

## Pages

| Route      | Description                                     |
| ---------- | ----------------------------------------------- |
| `/`        | Dashboard with vehicle info and recent activity |
| `/login`   | Authentication page                             |
| `/diesel`  | Log and view diesel fill-ups                    |
| `/freight` | Log and view freight trips                      |
| `/profile` | User profile and settings                       |

## PWA Installation

### iOS (Safari)

1. Open the app in Safari
2. Tap the Share button
3. Select "Add to Home Screen"

### Android (Chrome)

1. Open the app in Chrome
2. Tap the menu (three dots)
3. Select "Add to Home screen" or "Install app"

### Desktop (Chrome/Edge)

1. Click the install icon in the address bar
2. Or go to Menu → Install app

## Environment Variables

| Variable                        | Description                 |
| ------------------------------- | --------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Your Supabase project URL   |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anonymous key |

## Development

### Commands

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linting
npm run lint

# Type checking
npm run type-check
```

### Adding New Features

1. Create page in `src/app/[feature]/page.tsx`
2. Add navigation item in `src/components/layout/bottom-nav.tsx`
3. Update middleware if route needs protection

## Deployment

### Vercel (Recommended)

1. Connect your GitHub repository to Vercel
2. Add environment variables
3. Deploy

### Other Platforms

The app can be deployed to any platform supporting Next.js:

- AWS Amplify
- Netlify
- Railway
- Self-hosted with Docker

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## License

This project is proprietary to Car Craft Co.

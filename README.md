# 🐔 Game FNP

A gamified leaderboard visualization system that transforms traditional ranking displays into an engaging, animated chicken race experience. Built with React, TypeScript, and Tailwind CSS, integrating with the Funifier platform for real-time player data.

## Features

- 🏁 Interactive chicken race visualization with animated chickens representing players
- 📊 Real-time leaderboard data from Supabase
- 🔄 Auto-cycling between multiple leaderboards
- 📱 Responsive design for desktop and mobile
- 🎯 Hover tooltips with detailed player information
- 📋 Traditional ranking sidebar and detailed table view
- ⚡ Real-time updates via Supabase subscriptions

## Tech Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS
- **Animation**: Framer Motion
- **Backend**: Supabase (PostgreSQL, Real-time, Auth)
- **API Client**: Supabase JS Client
- **Build Tool**: Vite
- **Deployment**: Vercel

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy environment variables:
   ```bash
   cp .env.example .env.local
   ```

4. Update `.env.local` with your Supabase credentials:
   ```bash
   npm run setup:supabase
   ```

5. Set up the database:
   - Open Supabase Studio at https://fnp.centralsupernova.com.br
   - Run the SQL schema from `supabase-schema.sql`

6. Start the development server:
   ```bash
   npm run dev
   ```

## Deployment

This project is configured for deployment on Vercel with automatic CI/CD.

### Quick Deploy to Vercel

1. **Verify deployment setup**:
   ```bash
   npm run verify:deployment
   ```

2. **Push to GitHub** and connect to Vercel

3. **Set environment variables** in Vercel dashboard:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

4. **Deploy automatically** via GitHub integration

For detailed deployment instructions, see [DEPLOYMENT.md](./DEPLOYMENT.md) and [DEPLOYMENT-CHECKLIST.md](./DEPLOYMENT-CHECKLIST.md).

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint issues
- `npm run format` - Format code with Prettier
- `npm run type-check` - Run TypeScript type checking

### Migration Scripts (Funifier → Supabase)

- `npm run migrate:export` - Export data from Funifier API (if migrating)
- `npm run migrate:import` - Import data to Supabase
- `npm run migrate:schema` - Instructions for running database schema
- `npm run setup:supabase` - Setup Supabase environment variables

See [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md) for complete migration instructions.

## Project Structure

```
src/
├── components/     # React components
├── services/       # API services and external integrations
├── types/          # TypeScript type definitions
├── utils/          # Utility functions
├── hooks/          # Custom React hooks
├── store/          # State management
├── App.tsx         # Main application component
├── main.tsx        # Application entry point
└── style.css       # Global styles and Tailwind imports
```

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_SUPABASE_URL` | Supabase project URL | `https://your-project.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous key | `your_anon_key_here` |
| `VITE_APP_TITLE` | Application title | `Chicken Race Ranking` |
| `VITE_API_POLLING_INTERVAL` | API polling interval in ms | `30000` |

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

## License

This project is private and proprietary.
# 🐔 Game FNP

A gamified leaderboard visualization system that transforms traditional ranking displays into an engaging, animated chicken race experience. Built with React, TypeScript, and Tailwind CSS, integrating with the Funifier platform for real-time player data.

## Features

- 🏁 Interactive chicken race visualization with animated chickens representing players
- 📊 Real-time leaderboard data from Funifier API
- 🔄 Auto-cycling between multiple leaderboards
- 📱 Responsive design for desktop and mobile
- 🎯 Hover tooltips with detailed player information
- 📋 Traditional ranking sidebar and detailed table view

## Tech Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS
- **Animation**: Framer Motion
- **API**: Axios for HTTP requests
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

4. Update `.env.local` with your Funifier API credentials

5. Start the development server:
   ```bash
   npm run dev
   ```

## Deployment & Raspberry Pi Kiosk

This project is deployed on Vercel and optimized for Raspberry Pi 4 kiosk mode on TV displays.

### Quick Deploy to Vercel

1. **Push to GitHub** and connect to Vercel

2. **Set environment variables** in Vercel dashboard:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (for API routes)

3. **Deploy automatically** via GitHub integration

For detailed deployment instructions, see [DEPLOYMENT.md](./DEPLOYMENT.md).

For the complete guide covering Raspberry Pi setup, TV scaling, performance tuning, known issues, and troubleshooting, see **[RASPBERRY_PI_KIOSK_GUIDE.md](./RASPBERRY_PI_KIOSK_GUIDE.md)**.

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint issues
- `npm run format` - Format code with Prettier
- `npm run type-check` - Run TypeScript type checking

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
| `VITE_FUNIFIER_SERVER_URL` | Funifier API base URL | `https://your-funifier-server.com` |
| `VITE_FUNIFIER_API_KEY` | Your Funifier API key | `your_api_key_here` |
| `VITE_FUNIFIER_AUTH_TOKEN` | Basic auth token for Funifier | `Basic your_base64_encoded_token_here` |
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
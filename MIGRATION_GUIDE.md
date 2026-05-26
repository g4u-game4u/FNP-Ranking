# FNP Ranking - Deployment & Raspberry Pi Kiosk Guide

> **Single source of truth** for deploying the Chicken Race Ranking app to Vercel and running it as a kiosk on Raspberry Pi connected to a TV.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Variables](#environment-variables)
3. [Vercel Deployment](#vercel-deployment)
4. [Raspberry Pi Kiosk Setup](#raspberry-pi-kiosk-setup)
5. [TV Display Configuration](#tv-display-configuration)
6. [Performance Optimizations](#performance-optimizations)
7. [Known Issues & Fixes](#known-issues--fixes)
8. [Monitoring & Debugging](#monitoring--debugging)
9. [Troubleshooting](#troubleshooting)

---

## Prerequisites

| Requirement | Details |
|-------------|---------|
| Node.js | 18+ |
| Raspberry Pi | Model 4 (4GB RAM recommended) |
| Browser | Firefox (kiosk mode) or Chromium |
| Vercel Account | [vercel.com](https://vercel.com) |
| Funifier Credentials | API key + auth token |

---

## Environment Variables

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_FUNIFIER_SERVER_URL` | Funifier API URL with version | `https://service2.funifier.com/v3` |
| `VITE_FUNIFIER_API_KEY` | Your Funifier API key | `your_api_key_here` |
| `VITE_FUNIFIER_AUTH_TOKEN` | Basic auth token | `Basic your_base64_token` |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_APP_TITLE` | Application title | `Chicken Race Ranking` |
| `VITE_API_POLLING_INTERVAL` | Polling interval (ms) | `30000` |

### Setting Up in Vercel

1. Go to **Project Dashboard** → **Settings** → **Environment Variables**
2. Add each variable for **Production**, **Preview**, and **Development** environments
3. Use separate credentials for production vs. preview when possible

> **Security**: Never commit credentials to the repository. The `.env.example` file shows the required shape without real values.

---

## Vercel Deployment

### Initial Setup

1. **Import repository** in Vercel dashboard → "New Project" → select your GitHub repo
2. **Build settings** (auto-detected):
   - Framework: Vite
   - Build command: `npm run build`
   - Output directory: `dist`
3. **Deploy** — Vercel will use the `vercel.json` config automatically

### Automatic Deployments

| Trigger | Environment |
|---------|-------------|
| Push to `main` | Production |
| Pull request | Preview (URL posted as PR comment) |

### Build Optimizations (built-in via `vercel.json`)

- **Code splitting**: vendor (React), animations (Framer Motion), utils (Axios/date-fns)
- **Caching**: 1-year immutable for static assets, no-cache for HTML
- **Compression**: Automatic gzip/brotli
- **Security headers**: X-Content-Type-Options, X-Frame-Options, X-XSS-Protection

### Rollback

1. Go to **Deployments** tab in Vercel
2. Find a previous successful deployment
3. Click **"Promote to Production"**

### Verify Deployment

```bash
npm run verify:deployment
```

---

## Raspberry Pi Kiosk Setup

### Hardware Preparation

1. Flash Raspberry Pi OS (64-bit recommended for better performance)
2. Enable GPU memory split: set `gpu_mem=128` in `/boot/config.txt`
3. Ensure stable network connection (Ethernet preferred over WiFi)

### Browser Kiosk Mode

**Firefox (recommended):**

```bash
firefox --kiosk --new-instance https://your-vercel-url.vercel.app
```

**Chromium (alternative):**

```bash
chromium-browser --kiosk --disable-infobars --noerrdialogs https://your-vercel-url.vercel.app
```

### Auto-Start on Boot

Create a systemd service or add to `~/.config/lxsession/LXDE-pi/autostart`:

```bash
@xset s off
@xset -dpms
@xset s noblank
@firefox --kiosk --new-instance https://your-vercel-url.vercel.app
```

### Service Worker Auto-Update

The service worker automatically:
- Uses timestamp-based cache versioning (unique on every build)
- Activates immediately with `skipWaiting()`
- Triggers automatic reload when new content is available
- Checks for updates every **5 minutes** in kiosk mode

> After deploying a new version, the Raspberry Pi will auto-update within 5 minutes — no manual refresh needed.

---

## TV Display Configuration

### Automatic Scaling

The app automatically detects display size and applies appropriate scaling:

| Display Size | Scale Factor | Touch Target |
|-------------|-------------|--------------|
| 12-24" (monitor) | 1.0-1.25x | 44px |
| 25-32" (large monitor) | 1.6x | 56px |
| 32-39" (small TV) | 2.0x | 72px |
| 40-49" (TV) | 2.4x | 96px |
| 50"+ (large TV) | 2.8x | 120px |

### TV-Specific Optimizations (automatic)

- Enhanced contrast and brightness for viewing distance
- Larger fonts with increased weight and letter-spacing
- Disabled text selection for kiosk mode
- Optimized font rendering for TV panels
- Hardware-accelerated CSS transforms

### If Content Looks Wrong on TV

The system uses `transform-origin: top center` on the `#root` element. If you see stretching:
1. Verify the display resolution is correctly reported
2. Check that no manual zoom is applied in the browser
3. Use `Ctrl+Shift+P` to open the performance dashboard and check detected display size

---

## Performance Optimizations

### Bundle Size

| Metric | Value | Target |
|--------|-------|--------|
| Total bundle | ~400KB | <2MB |
| Largest chunk | ~138KB (react-vendor) | <400KB |
| All chunks | Under 400KB | ✓ |

### ARM Architecture Optimizations

- Automatic ARM device detection (userAgent/platform)
- Memory cleanup triggered at 75% usage (1.5GB threshold)
- Animation quality reduced when FPS drops below 25
- Enhanced network caching for latency >1000ms
- Emergency mode for critical resource usage

### Performance Targets

| Metric | Target | Notes |
|--------|--------|-------|
| Initial load | <10 seconds | On Raspberry Pi 4 |
| Frame rate | >25 FPS | ARM-optimized |
| Memory usage | <1.5GB peak | For Pi 4 (4GB RAM) |
| Input latency | <200ms | Touch/mouse |
| Network caching | Aggressive | 30s polling default |

### Resource Priority (under constraints)

1. **Critical**: Leaderboard display, basic navigation
2. **High**: Real-time updates, core animations
3. **Medium**: Advanced animations, visual effects
4. **Low**: Non-essential UI enhancements

---

## Known Issues & Fixes

### 1. Kiosk Loading Old Version (Cache Issue)

**Symptom**: Old UI with current data after deployment.

**Cause**: Service worker had static version numbers that never invalidated.

**Fix** (already applied):
- Dynamic cache versioning with `Date.now()`
- `skipWaiting()` for immediate service worker activation
- Automatic client reload on cache update
- 5-minute periodic update checks

**Verify**: Check browser console for `"New content available, reloading..."` message.

### 2. Goal Tracker Always Showing Complete

**Symptom**: Progress bar permanently at 100%.

**Cause**: Was tracking a single player who had already completed the challenge.

**Fix** (already applied):
- Now tracks the player with highest active progress (the "leader")
- Shows "(Líder)" label
- Updates every 30 seconds

### 3. Stretched/Elongated Display on TV

**Symptom**: Content horizontally stretched on TV screens.

**Cause**: CSS transform applied to `body` with `transform-origin: top left`.

**Fix** (already applied):
- Transform moved to `#root`/`#app` containers
- `transform-origin` changed to `top center`
- Proper `100vh` height calculation
- Box-sizing corrections

---

## Monitoring & Debugging

### Performance Dashboard

Press **`Ctrl+Shift+P`** to open the real-time debug dashboard showing:
- Memory, CPU, frame rate, network latency
- ARM device detection status
- Active optimizations
- Recent performance alerts
- Raspberry Pi-specific tips

### Automatic Alerting

The app has a multi-level alerting system:
- **Low**: Minor performance dip (logged only)
- **Medium**: Noticeable degradation (reduce animations)
- **High**: Significant issues (disable non-critical features)
- **Critical**: Emergency mode (minimal rendering, aggressive cleanup)

### Service Worker Logs

Open browser console to see:
- Cache update events
- Version changes
- Reload triggers
- Update check intervals

### Goal Tracker Monitoring

Console logs show:
- Top player progress fetching
- Challenge progress percentage
- Player switching events

---

## Troubleshooting

### Build Failures

| Issue | Solution |
|-------|----------|
| Missing env vars | Ensure all `VITE_*` vars are set in Vercel |
| Dependency errors | Run `npm ci` for clean install |
| Type errors | Run `npm run type-check` locally first |

### API Connection Issues

| Issue | Solution |
|-------|----------|
| 401 Unauthorized | Check `VITE_FUNIFIER_AUTH_TOKEN` format (`Basic ...`) |
| CORS errors | Verify Funifier server allows your Vercel domain |
| Timeout | Check network stability, app will auto-retry |

### Raspberry Pi Issues

| Issue | Solution |
|-------|----------|
| Blank screen | Check URL is correct, network is connected |
| Slow loading | Verify GPU memory split, use Ethernet |
| High memory | Restart browser, check for memory leaks in console |
| No auto-update | Check service worker is registered (console) |

### TV Display Issues

| Issue | Solution |
|-------|----------|
| Too small | Check display detection in `Ctrl+Shift+P` dashboard |
| Stretched | Ensure no manual zoom, check `transform-origin` |
| Blurry text | Verify hardware acceleration is enabled in browser |
| Cut off edges | Check TV overscan settings, try "PC mode" on TV |

---

## Quick Reference

### Build & Deploy

```bash
# Local development
npm run dev

# Production build
npm run build

# Preview production build locally
npm run preview

# Verify deployment config
npm run verify:deployment

# Lint & format
npm run lint:fix && npm run format
```

### Kiosk Launch Commands

```bash
# Firefox kiosk (recommended)
firefox --kiosk --new-instance https://your-app.vercel.app

# Chromium kiosk (alternative)
chromium-browser --kiosk --disable-infobars https://your-app.vercel.app
```

### Key URLs

| Resource | URL |
|----------|-----|
| Vercel Dashboard | `https://vercel.com/your-team/fnp-ranking` |
| Production | Your configured Vercel domain |
| Preview | Auto-generated per PR |

---

## Security Checklist

- [ ] Environment variables set in Vercel (not in code)
- [ ] Production credentials separate from development
- [ ] HTTPS enforced (automatic with Vercel)
- [ ] No sensitive data in client-side bundle
- [ ] Security headers configured in `vercel.json`
- [ ] Input validation active on all user inputs
- [ ] Output sanitization prevents XSS
- [ ] Service worker uses secure update mechanism

---

*This guide consolidates all deployment, optimization, and kiosk configuration documentation. For code-level implementation details, see the inline comments and type definitions in the source code.*

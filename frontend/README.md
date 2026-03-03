# Collaborative Board Frontend

## Setup

1. Copy `.env.example` to `.env`.
2. Set values for:
   - `VITE_API_BASE_URL`
   - `VITE_WS_URL`
   - `VITE_ICE_SERVERS` (JSON array string; include TURN in production)
   - `VITE_DEBUG_LOGS`

## Scripts

- `npm run dev` - start local dev server
- `npm run build` - build production bundle
- `npm run preview` - preview built app locally
- `npm run lint` - run ESLint

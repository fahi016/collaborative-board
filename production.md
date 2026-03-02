# Production Deployment Plan

This document is tailored for:
- Backend: Render (Web Service)
- Redis: Render (Redis)
- Database: Neon (PostgreSQL)
- Frontend: Netlify

## 1. Architecture

- Netlify serves the React app.
- Render runs Spring Boot backend.
- Backend connects to Neon Postgres + Render Redis.
- Browser calls backend REST + SockJS (`/ws`) over HTTPS.

## 2. Prerequisites

- GitHub repo connected to Render and Netlify.
- Neon project created with one production database.
- Render Redis instance created.
- A strong JWT secret generated.

JWT secret example generation:

```bash
openssl rand -base64 64
```

## 3. Backend on Render

Create a **Render Web Service**:
- Runtime: `Java`
- Root Directory: `backend`
- Build Command: `./mvnw clean package -DskipTests`
- Start Command: `java -Dserver.port=$PORT -jar target/backend-0.0.1-SNAPSHOT.jar`

Health check:
- Path: `/actuator/health`

### Required backend environment variables (Render)

Set these in Render service environment:

- `POSTGRES_USER` = Neon DB username
- `POSTGRES_PASSWORD` = Neon DB password
- `JWT_SECRET` = strong random secret
- `FRONTEND_URL` = your Netlify production URL (example: `https://your-app.netlify.app`)
- `JPA_DDL_AUTO` = `validate` (recommended after schema is stable)

Also override DB and Redis connection from localhost defaults:

- `SPRING_DATASOURCE_URL` = Neon JDBC URL  
  Example:
  `jdbc:postgresql://<neon-host>/<db-name>?sslmode=require`
- `SPRING_REDIS_HOST` = Render Redis host
- `SPRING_REDIS_PORT` = Render Redis port (usually `6379`)
- `SPRING_REDIS_PASSWORD` = Render Redis password (if provided)

Optional but useful:
- `JWT_EXPIRATION` if you decide to externalize token duration later
- `LOGGING_LEVEL_COM_COLLAB=INFO` (or `DEBUG` temporarily for troubleshooting)

## 4. Neon PostgreSQL setup

In Neon:
- Create production database and user.
- Copy host, database name, username, password.
- Ensure SSL is required (`sslmode=require` in JDBC URL).

Schema strategy:
- First production deploy can use `JPA_DDL_AUTO=update` if schema not created.
- After first successful deploy and verification, switch to `JPA_DDL_AUTO=validate`.

## 5. Render Redis setup

Create Redis on Render and capture:
- Internal host
- Port
- Password (if enabled)

Map to backend env vars:
- `SPRING_REDIS_HOST`
- `SPRING_REDIS_PORT`
- `SPRING_REDIS_PASSWORD`

Keep backend and Redis in the same Render region for lower latency.

## 6. Frontend on Netlify

Create Netlify site:
- Base directory: `frontend`
- Build command: `npm run build`
- Publish directory: `dist`

### Required frontend environment variables (Netlify)

- `VITE_API_BASE_URL` = Render backend public URL  
  Example: `https://your-backend.onrender.com`
- `VITE_WS_URL` = backend SockJS endpoint  
  Example: `https://your-backend.onrender.com/ws`
- `VITE_API_TIMEOUT_MS` = `15000` (or your preferred value)
- `VITE_DEBUG_LOGS` = `false` (set `true` only for debugging)

Important:
- Do not use `http://` in production values. Use `https://`.
- Because backend CORS currently allows a single origin, keep `FRONTEND_URL` exactly matching the Netlify production domain (no trailing slash).

## 7. Deployment order

1. Provision Neon DB and Render Redis.
2. Deploy backend on Render with all env vars set.
3. Confirm backend health at `/actuator/health`.
4. Deploy frontend on Netlify with production env vars.
5. Update backend `FRONTEND_URL` to the final Netlify URL (if changed).
6. Re-deploy backend once if env values changed.

## 8. Post-deploy verification checklist

Backend checks:
- `GET /actuator/health` returns UP.
- Login/register works.
- Creating room works.
- Join room works until 6 users, then full-room behavior triggers.
- WebSocket connect/subscription works for authorized users only.

Frontend checks:
- No mixed-content errors in browser console.
- Room join/create flows work.
- Chat history endpoint works.
- Real-time board + chat + voice signaling works across two browsers.

Data checks:
- New users/rooms persist in Neon.
- Redis keys are created during active usage and cleaned when expected.

## 9. Security and production hardening

- Keep `JWT_SECRET`, DB password, Redis password only in platform secrets.
- Keep `VITE_DEBUG_LOGS=false`.
- Use `JPA_DDL_AUTO=validate` after initial stabilization.
- Keep actuator exposure minimal (`health,info` already configured).
- Add periodic DB backups/snapshots in Neon.

## 10. Known app-specific caveats

- CORS is currently single-origin (`FRONTEND_URL` only). Netlify preview deploy URLs will be blocked unless backend CORS is expanded.
- If you use a custom domain on Netlify later, update both:
  - Netlify env vars (`VITE_API_BASE_URL`, `VITE_WS_URL`) if needed
  - Render backend `FRONTEND_URL`

## 11. Rollback plan

If a deployment fails:

1. Roll back Netlify to previous successful deploy.
2. Roll back Render backend to previous successful deploy.
3. Restore previous env vars if changed.
4. If schema change caused issue, restore Neon snapshot/branch and redeploy backend.


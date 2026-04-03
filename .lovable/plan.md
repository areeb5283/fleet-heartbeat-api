

## Vehicle Telematics Platform — Hybrid Plan

### Part 1: Interactive Dashboard (Lovable — TanStack Start + Supabase)

**Authentication & Roles**
- Supabase Auth with email/password login & registration
- Role-based access (admin, user) using a `user_roles` table with RLS

**Database Tables (Supabase/PostgreSQL)**
- `vehicles` — vehicle_id, model, manufacturer, year, fuel_type, owner (FK to auth.users)
- `telematics_data` — speed, rpm, engine_temp, fuel_level, latitude, longitude, timestamp, vehicle_id
- `trips` — start_time, end_time, distance, avg_speed, vehicle_id, status (active/completed)
- `alerts` — type (overspeed/high_temp/low_fuel), message, severity, vehicle_id, timestamp, acknowledged
- `user_roles` — user_id, role (admin/user)

**Dashboard Pages**
1. **Login / Register** — auth forms with role assignment
2. **Dashboard Home** — overview cards (total vehicles, active trips, unacknowledged alerts, total distance)
3. **Vehicles** — CRUD table for managing vehicles, linked to logged-in user
4. **Live Tracking** — simulated real-time vehicle data display with auto-refreshing telematics feed, map placeholder showing GPS coordinates
5. **Trips** — trip history table with filters, trip detail view with stats
6. **Alerts** — alert feed with severity badges, acknowledge/dismiss actions, filtering by type
7. **Analytics** — charts for distance over time, average speed trends, fuel consumption (using Recharts)

**Server Functions**
- Telematics data ingestion endpoint (validates & stores sensor readings, auto-generates alerts for overspeed >120km/h, engine temp >100°C, fuel <10%)
- Trip management (auto-create on engine start signal, close on engine stop)
- Analytics aggregation queries
- Simulated data generator for demo purposes

### Part 2: Downloadable Express + MongoDB API (Reference Code)

Generated as downloadable files covering:
- Express.js REST API with JWT auth, MVC structure
- Mongoose models for all collections (users, vehicles, telematics_data, trips, alerts)
- Routes, controllers, services layer
- Socket.io real-time streaming setup
- Swagger/OpenAPI documentation
- Docker compose with MongoDB
- Rate limiting & security middleware (helmet, cors, express-rate-limit)
- Sample request/response examples in a README

### Implementation Order
1. Set up Supabase database schema & RLS policies
2. Build auth flow (login, register, roles)
3. Create vehicle management pages
4. Build telematics ingestion + alert generation
5. Add trip management
6. Build analytics dashboard with charts
7. Add live tracking view with simulated data
8. Generate Express + MongoDB reference codebase as downloadable files


# Project Memory

## Core
Dark theme only (class="dark"). Primary oklch(0.65 0.2 250). Inter font.
Supabase/Lovable Cloud backend. Vehicle telematics platform "VehicleIQ".
Roles in user_roles table (app_role enum: admin, user). has_role() security definer.

## Memories
- [DB Schema](mem://features/db-schema) — vehicles, telematics_data, trips, alerts, user_roles, breakdowns, maintenance_records tables with RLS
- [Auth flow](mem://features/auth) — Supabase Auth email/password, auto-assign 'user' role on signup
- [Dashboard pages](mem://features/dashboard) — Overview, Vehicles CRUD, Live Tracking (Leaflet map + breakdown), Trips, Alerts, Maintenance (AI), Analytics
- [Alert thresholds](mem://features/alert-rules) — overspeed >120km/h, engine_temp >100°C, fuel <10%
- [Breakdown system](mem://features/breakdowns) — 7 breakdown types with causes/precautions, dispatch/contact authorities, resolve workflow
- [Maintenance AI](mem://features/maintenance) — predict-maintenance edge function using Lovable AI, 9 categories, condition tracking

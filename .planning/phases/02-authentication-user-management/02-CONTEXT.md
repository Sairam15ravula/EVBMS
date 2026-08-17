# Phase 2: Authentication & User Management - Context

**Gathered:** 2026-08-17  
**Status:** Ready for planning  

<domain>
## Phase Boundary

This phase implements user authentication, password security, JWT token lifecycle management, Role-Based Access Control (RBAC), and vehicle asset ownership scoping across both the FastAPI Python backend and React 19 frontend.

</domain>

<decisions>
## Implementation Decisions

### Security Stack & Cryptography
- Use **PyJWT** (`pyjwt[crypto]`) for JWT token signing and verification using `HS256` or `RS256` algorithm.
- Use **Passlib** with `bcrypt` / `argon2` for password hashing and verification.
- Token Architecture:
  - Short-lived **Access Token** (30 minutes expiry) passed in `Authorization: Bearer <token>` header.
  - Long-lived **Refresh Token** (7 days expiry) for background token renewal.

### Role-Based Access Control (RBAC)
- Supported Roles: `admin`, `fleet_manager`, `technician`, `driver`.
- FastAPI Dependency: `require_role(allowed_roles=[...])` decorator/dependency guarding routes.
- Asset Scoping: Fleet managers and technicians can access all assigned vehicles in their organization; drivers can access only their assigned vehicle asset.

### Frontend Integration & Session Persistence
- React context `AuthContext` storing `user`, `accessToken`, `role`, `isAuthenticated`, and auth helper functions (`login`, `logout`, `refreshToken`).
- Persistent storage: Refresh token stored securely in `localStorage` or HttpOnly cookie with silent token refresh on page reload.
- Protected Route wrapper component `ProtectedRoute.tsx` redirecting unauthenticated users to `/login`.

</decisions>

<canonical_refs>
## Canonical References

- `backend/db/models.py` — `UserModel` and `VehicleModel` ORM classes created in Phase 1
- `backend/db/repositories/user_repo.py` — `UserRepository` created in Phase 1
- `src/types.ts` — Frontend TypeScript interfaces
- `.planning/REQUIREMENTS.md` — AUTH-01 through AUTH-04 requirements

</canonical_refs>

---
*Phase: 02-authentication-user-management*

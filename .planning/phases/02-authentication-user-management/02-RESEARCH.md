# Phase 2: Authentication & User Management - Research

*Researched: 2026-08-17*

## Key Technical Decisions & Security Patterns

### 1. Password Hashing Strategy
- **Library**: `passlib[bcrypt]` or `passlib[argon2]`
- **Implementation**:
  ```python
  from passlib.context import CryptContext
  pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
  
  def hash_password(password: str) -> str:
      return pwd_context.hash(password)
      
  def verify_password(plain_password: str, hashed_password: str) -> bool:
      return pwd_context.verify(plain_password, hashed_password)
  ```

### 2. JWT Access & Refresh Token Management
- **Library**: `PyJWT` (`import jwt`)
- **Key Config**: `SECRET_KEY` env var (default fallback for dev), `ALGORITHM = "HS256"`, `ACCESS_TOKEN_EXPIRE_MINUTES = 30`.
- **Payload Schema**:
  ```json
  {
    "sub": "user_uuid",
    "email": "user@example.com",
    "role": "fleet_manager",
    "type": "access",
    "exp": 1776450000
  }
  ```

### 3. FastAPI Security Dependency & Role Enforcement
- Use `OAuth2PasswordBearer(tokenUrl="/api/auth/login")` and custom `get_current_user` dependency.
- Role checking dependency factory:
  ```python
  def require_role(roles: list[str]):
      async def role_checker(user: UserModel = Depends(get_current_user)):
          if user.role not in roles:
              raise HTTPException(status_code=403, detail="Permission denied")
          return user
      return role_checker
  ```

### 4. React Auth State & Session Lifecycle
- `AuthContext.tsx` maintains global state and exposes `useAuth()` hook.
- Axios/fetch interceptor attaches `Authorization: Bearer <token>` to outbound requests and handles 401 Unauthorized token refresh logic.

## Validation Architecture

### Verification Commands
- `python -m pytest tests/test_auth.py`
- Manual API tests via Swagger UI (`/docs`)

# Auth Persistence Race Condition on Page Reload

**Date**: 2025-12-05
**Issue**: Users redirected to login page after page refresh despite being authenticated
**Severity**: High
**Category**: Logic/Race Condition

## Symptoms

1. User logs in successfully with admin@example.com / password123
2. Login succeeds, redirects to dashboard
3. User refreshes the page (F5 or browser refresh)
4. User is redirected back to /login instead of staying on the current page

## Root Cause Analysis

The bug was a **race condition** between React's state initialization and the useEffect lifecycle.

### Original Code Flow (Broken)

```
AuthContext.tsx (lines 21-22):
  const [user, setUser] = useState<User | null>(null);           // Always null initially
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));

  useEffect(() => {
    if (token) {
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        setUser(JSON.parse(storedUser));  // User restored AFTER first render
      }
    }
  }, [token]);
```

```
ProtectedRoute.tsx (lines 10-14):
  const { user } = useAuth();

  if (!user) {                            // Checks on FIRST render, before useEffect runs
    return <Navigate to="/login" />;
  }
```

### Timeline of Bug

1. **T0**: Page loads, React initializes `AuthProvider`
2. **T1**: `useState` runs synchronously:
   - `user = null`
   - `token = "valid-jwt-token"` (from localStorage)
3. **T2**: `ProtectedRoute` renders, reads `user = null`
4. **T3**: `Navigate to="/login"` executes immediately
5. **T4**: `useEffect` runs (too late) - would have restored `user` from localStorage

The redirect happened between T2-T3, before the useEffect at T4 could restore the user.

## Solution

### Fix Strategy: Synchronous State Initialization

Instead of relying on `useEffect` to restore auth state (async), we restore it during `useState` initialization (sync).

### Files Changed

#### 1. `/client/src/context/AuthContext.tsx`

**Added helper function** (lines 21-39):
```typescript
// Helper to restore auth state synchronously from localStorage
const getInitialAuthState = () => {
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');

    if (token && storedUser) {
        try {
            const user = JSON.parse(storedUser);
            axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
            return { token, user };
        } catch {
            // Invalid stored user, clear it
            localStorage.removeItem('user');
            localStorage.removeItem('token');
        }
    }

    return { token: null, user: null };
};
```

**Changed state initialization** (lines 42-45):
```typescript
const [authState] = useState(getInitialAuthState);
const [user, setUser] = useState<User | null>(authState.user);
const [token, setToken] = useState<string | null>(authState.token);
const [isLoading, setIsLoading] = useState(false);
```

**Updated interface** (line 16):
```typescript
isLoading: boolean;  // Added to AuthContextType
```

**Updated provider value** (line 70):
```typescript
isAuthenticated: !!token && !!user  // Now requires both token AND user
```

#### 2. `/client/src/components/ProtectedRoute.tsx`

**Added loading check** (lines 10-14):
```typescript
const { user, isLoading } = useAuth();

if (isLoading) {
  return null;
}
```

### Fixed Timeline

1. **T0**: Page loads, React initializes `AuthProvider`
2. **T1**: `useState(getInitialAuthState)` runs synchronously:
   - Reads localStorage
   - Returns `{ token: "valid-jwt", user: { id: 1, ... } }`
   - `user` and `token` are immediately populated
3. **T2**: `ProtectedRoute` renders, reads `user = { id: 1, ... }`
4. **T3**: User check passes, children render normally

## Prevention

1. **Never rely on useEffect for critical initial state** - Use synchronous initialization via `useState` with a function
2. **Always provide loading states** for async auth operations
3. **isAuthenticated should check both token AND user** - A token alone is not sufficient for UI state

## Testing

1. Log in with valid credentials
2. Verify dashboard loads
3. Refresh page (F5)
4. Verify user remains on dashboard (not redirected to login)
5. Clear localStorage and refresh - verify redirect to login works
6. Test with corrupted localStorage user JSON - verify graceful handling

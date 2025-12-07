# Code Review Findings

## Summary
This document contains findings from a comprehensive code review of the SwapRunn project, organized by file and categorized by issue type: bugs, security vulnerabilities, performance issues, and inconsistencies.

---

## Critical Security Issues

### `src/pages/DriverDashboard.tsx`
**Line 372**: Potential SQL injection via string interpolation in query builder
```typescript
.or(`and(driver_id.is.null,status.eq.pending),and(driver_id.eq.${driverId},status.eq.pending_driver_acceptance)`)
```
**Issue**: While Supabase query builder generally protects against SQL injection, string interpolation in complex queries can be risky. Should use parameterized queries.
**Severity**: Medium
**Fix**: Use Supabase's query builder methods instead of string interpolation.

### `src/pages/Chat.tsx`
**Line 75**: Potential filter injection in realtime subscription
```typescript
filter: `delivery_id=eq.${deliveryId}`,
```
**Issue**: If `deliveryId` is not properly validated, this could allow unauthorized access to other deliveries.
**Severity**: Medium
**Fix**: Ensure `deliveryId` is validated before use, or use parameterized filters.

### `src/pages/SalesDashboard.tsx`
**Line 71**: Similar filter injection risk
```typescript
filter: `sales_id=eq.${sales.id}`,
```
**Severity**: Medium
**Fix**: Validate `sales.id` or use safer filter methods.

### Authorization Checks
**Multiple files**: Missing explicit authorization checks before data access
- `src/pages/DriverDashboard.tsx`: `loadRequestDeliveries` doesn't verify driver ownership
- `src/pages/Chat.tsx`: No check that user is authorized to view this delivery
- `src/pages/Profile.tsx`: Relies on RLS but no explicit check

**Severity**: High
**Fix**: Add explicit authorization checks before loading data, even if RLS is enabled.

---

## Bugs

### `src/pages/DriverDashboard.tsx`

**Line 616-794**: Race condition in `handleAcceptDelivery`
- Multiple drivers could accept the same delivery simultaneously
- The check-then-update pattern is not atomic
**Severity**: High
**Fix**: Use database-level constraints or optimistic locking.

**Line 84-264**: Memory leak risk in realtime subscription
- Channel cleanup may not run if component unmounts during async operation
- `channelRef.current` may be null when cleanup runs
**Severity**: Medium
**Fix**: Store channel reference more reliably and ensure cleanup always runs.

**Line 266-289**: Polling interval not properly cleaned up
- If component unmounts while polling, interval may continue
**Severity**: Low
**Fix**: Ensure `stopPolling()` is always called in cleanup.

**Line 774**: Potential null reference
```typescript
const acceptedDelivery = requestDeliveries.find(d => d.id === deliveryId);
if (acceptedDelivery) {
  setUpcomingDeliveries(prev => [{
    ...acceptedDelivery,
    // ...
  }, ...prev]);
} else {
  console.warn('[AcceptDelivery] Could not find accepted delivery in request list');
}
```
**Issue**: If delivery is accepted but not in `requestDeliveries` (e.g., from realtime update), it won't be added to upcoming.
**Severity**: Medium
**Fix**: Reload upcoming deliveries after acceptance or fetch delivery details.

### `src/pages/SalesDashboard.tsx`

**Line 231-406**: Missing validation for required fields
- VIN validation exists but other fields (addresses) may be empty
**Severity**: Low
**Fix**: Add comprehensive form validation.

**Line 398-401**: Potential null reference
```typescript
.eq("dealer_id", dealer?.id || '')
```
**Issue**: If `dealer` is null, query will fail silently or return wrong results.
**Severity**: Medium
**Fix**: Add null check before query.

### `src/pages/Chat.tsx`

**Line 155-161**: Memory leak in typing indicator
- `typingTimeoutRef` may not be cleared if component unmounts
**Severity**: Low
**Fix**: Clear timeout in cleanup.

**Line 293-370**: Missing error handling in `handleConfirmSchedule`
- If driver lookup fails, `driverUserId` will be null but code continues
**Severity**: Medium
**Fix**: Add proper error handling and validation.

### `src/pages/DealerDashboard.tsx`

**Line 398-401**: Similar null reference issue as SalesDashboard
```typescript
.eq("dealer_id", dealer?.id || '')
```
**Severity**: Medium

**Line 633**: Using `confirm()` for destructive action
```typescript
if (!confirm("Are you sure you want to remove this team member?")) return;
```
**Issue**: `confirm()` is blocking and not user-friendly. Should use modal.
**Severity**: Low
**Fix**: Use ConfirmationModal component (already exists in codebase).

### `src/contexts/AuthContext.tsx`

**Line 64-76**: Race condition in auth state change handler
- Async function in `onAuthStateChange` callback may complete after component unmounts
- `isMounted` flag not checked in callback
**Severity**: Medium
**Fix**: Check `isMounted` before state updates in callback.

**Line 33-36**: Using `alert()` and `window.location.href`
- `alert()` is blocking and not user-friendly
- `window.location.href` causes full page reload
**Severity**: Low
**Fix**: Use toast notification and React Router navigation.

### `src/lib/adminInvitations.ts`

**Line 14**: Case-insensitive email comparison
```typescript
.ilike('email', userEmail)
```
**Issue**: Email comparison should be case-insensitive, but this is correct. However, should normalize email before comparison.
**Severity**: Low
**Fix**: Normalize email to lowercase before comparison.

### `src/hooks/useSessionTimeout.ts`

**Line 21-36**: Potential race condition
- `checkSession` runs every 60 seconds but `lastActivity` is updated on every event
- If user is active but `checkSession` runs between events, session may timeout incorrectly
**Severity**: Low
**Fix**: Use debouncing or check time since last activity more accurately.

---

## Performance Issues

### `src/pages/DriverDashboard.tsx`

**Line 466-500**: N+1 query problem in `loadApprovedDealerships`
- For each dealership, makes 3 separate count queries
- Could be optimized with a single query using aggregations
**Severity**: Medium
**Fix**: Use database aggregations or batch queries.

**Line 330-398**: Inefficient query in `loadRequestDeliveries`
- Fetches all deliveries then filters in memory
- Should use database filtering
**Severity**: Low
**Fix**: Already using `.or()` filter, but could be optimized further.

**Line 84-264**: Realtime subscription may receive unnecessary updates
- Subscribes to all delivery changes, not just relevant ones
**Severity**: Low
**Fix**: Use more specific filters in subscription.

### `src/pages/SalesDashboard.tsx`

**Line 183-229**: N+1 query in `loadDrivers`
- Fetches approved drivers then makes separate queries for each
**Severity**: Medium
**Fix**: Use joins or batch queries.

**Line 450-465**: Client-side filtering instead of database filtering
- `filteredDeliveries` filters in memory after fetching all deliveries
**Severity**: Low
**Fix**: Move filtering to database query.

### `src/pages/DealerDashboard.tsx`

**Line 513-523**: Client-side filtering
- Similar issue as SalesDashboard
**Severity**: Low

**Line 166-197**: Multiple separate queries for drivers
- Could be combined into single query
**Severity**: Low

### `src/pages/Chat.tsx`

**Line 54-63**: Loads all messages without pagination
- For long conversations, this could be slow
**Severity**: Medium
**Fix**: Implement pagination or limit initial load.

### `src/lib/notificationService.ts`

**Line 56-112**: Audio context creation and cleanup
- Creates multiple oscillators without proper cleanup
- May cause memory leaks on mobile devices
**Severity**: Low
**Fix**: Properly cleanup audio resources.

---

## Inconsistencies

### Error Handling

**Inconsistent patterns across files:**
- Some functions use `try-catch` with toast notifications
- Others use `console.error` only
- Some throw errors, others return error objects
- `src/pages/DriverDashboard.tsx`: Uses both patterns inconsistently

**Recommendation**: Standardize error handling pattern across codebase.

### Loading States

**Inconsistent loading state management:**
- Some components use single `loading` state
- Others use multiple loading states (`loading`, `loadingRequests`, etc.)
- Some don't show loading indicators at all

**Recommendation**: Create consistent loading state pattern.

### Type Safety

**Missing type assertions and null checks:**
- `src/pages/DriverDashboard.tsx` Line 774: Uses `requestDeliveries.find()` without null check
- `src/pages/Chat.tsx` Line 49: Type assertion `data.sales as unknown as Sales` is unsafe
- Multiple places use `as` type assertions instead of proper type guards

**Recommendation**: Use type guards and proper null checks.

### Naming Conventions

**Inconsistent naming:**
- Some functions use `load*` prefix (e.g., `loadDriverData`)
- Others use `fetch*` or `get*`
- Some state variables use camelCase, others use snake_case in some contexts

**Recommendation**: Standardize naming conventions.

### Code Duplication

**Repeated patterns:**
- Delivery loading logic duplicated across DriverDashboard, SalesDashboard, DealerDashboard
- Notification creation logic duplicated
- Error handling patterns repeated

**Recommendation**: Extract common logic into shared utilities.

---

## File-by-File Summary

### `src/lib/supabase.ts`
- ✅ Good: Type definitions are comprehensive
- ⚠️ Minor: No validation of environment variables at runtime (only throws error)

### `src/lib/auth.ts`
- ✅ Good: Proper error handling
- ⚠️ Issue: `getUserRole()` makes multiple sequential queries - could be optimized

### `src/contexts/AuthContext.tsx`
- ⚠️ Bug: Race condition in auth state change handler
- ⚠️ Issue: Uses blocking `alert()` and full page reload

### `src/pages/DriverDashboard.tsx`
- 🔴 Critical: Race condition in delivery acceptance
- 🔴 Critical: Missing authorization checks
- ⚠️ Bug: Memory leak risk in subscriptions
- ⚠️ Performance: N+1 queries in dealership stats

### `src/pages/SalesDashboard.tsx`
- ⚠️ Security: Filter injection risk
- ⚠️ Bug: Null reference potential
- ⚠️ Performance: N+1 queries

### `src/pages/DealerDashboard.tsx`
- ⚠️ Bug: Null reference potential
- ⚠️ Issue: Uses blocking `confirm()`

### `src/pages/Chat.tsx`
- ⚠️ Security: Filter injection risk
- ⚠️ Bug: Missing error handling
- ⚠️ Performance: No pagination

### `src/pages/Profile.tsx`
- ✅ Good: Proper form handling
- ⚠️ Minor: Relies entirely on RLS (no explicit checks)

### `src/pages/Login.tsx`
- ✅ Good: Proper form validation
- ✅ Good: Remember me functionality

### `src/lib/validation.ts`
- ✅ Good: Comprehensive validation functions
- ✅ Good: Proper VIN validation

### `src/lib/adminInvitations.ts`
- ✅ Good: Proper error handling
- ⚠️ Minor: Email normalization could be improved

### `src/lib/retry.ts`
- ✅ Good: Proper retry logic with exponential backoff

### `src/lib/notificationService.ts`
- ⚠️ Performance: Audio context cleanup issues
- ✅ Good: Proper permission handling

### `src/hooks/useSessionTimeout.ts`
- ⚠️ Bug: Potential race condition in session checking

---

## Recommendations Priority

### High Priority
1. Fix race condition in delivery acceptance (DriverDashboard)
2. Add explicit authorization checks before data access
3. Fix memory leaks in realtime subscriptions
4. Fix filter injection risks in Chat and SalesDashboard

### Medium Priority
1. Optimize N+1 queries in dealership stats and driver loading
2. Add pagination to message loading
3. Fix null reference issues
4. Standardize error handling patterns

### Low Priority
1. Replace blocking `alert()` and `confirm()` with modals
2. Standardize loading state patterns
3. Extract common logic into utilities
4. Improve type safety with type guards

---

## Notes

- **SQL Injection**: Protected by Supabase query builder, but string interpolation in complex queries should be avoided
- **XSS**: Protected by React's default escaping, but should verify no `dangerouslySetInnerHTML` usage
- **RLS**: Row Level Security is enabled in database, but client-side checks should still be added for defense in depth
- **Authentication**: Supabase Auth is used, which is secure, but session management could be improved

---

## Testing Recommendations

1. Test race conditions in delivery acceptance with multiple simultaneous requests
2. Test authorization bypass attempts
3. Test memory leaks by monitoring component unmounts
4. Load test with large datasets (many deliveries, messages)
5. Test network failure scenarios and retry logic



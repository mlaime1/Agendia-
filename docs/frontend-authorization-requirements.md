# Frontend Authorization Requirements

The frontend must centralize role-based visibility and enforce protected navigation and actions consistently. These controls improve the user experience, but the backend remains the final security authority and must reject unauthorized requests.

## Quick path

1. Create one permission policy from the authenticated user's role and scope.
2. Use that policy in the app shell, drawer, screens, and action buttons.
3. Scope client and trip data to the authenticated user's permitted clients.
4. Handle `401` and `403` centrally in the API client.
5. Add regression tests for cross-client access and direct navigation.

## Recommended role policy

| Capability | Admin | Driver | Passenger | Client |
|---|---:|---:|---:|---:|
| View dashboard | Yes | Yes | Yes | Yes |
| View clients | All | Assigned clients | Linked clients only, or hidden | Own client context only |
| Create clients | Yes | Yes | No | No |
| Edit or delete clients | Yes | Assigned clients | No | No |
| View or create invitations | No, unless explicitly required | Yes | No | No |
| View calendar | All | Assigned clients | Linked clients only | Own client only |
| Manage summaries | Yes | Assigned clients | Read-only or hidden | Read-only or hidden |
| Manage payments | Yes | Assigned clients | No or read-only | No or read-only |

The final business policy must be confirmed with the product owner, especially for summary and payment visibility.

## Permission architecture

Create a single permission module, for example:

```text
permissions/
  permission.types.ts
  permission.policy.ts
  usePermissions.ts
```

Expose explicit capabilities instead of repeating role checks throughout the application:

```ts
permissions.canViewClients
permissions.canCreateClient
permissions.canCreateInvitation
permissions.canEditClient
permissions.canViewSummaries
permissions.canPaySummary
```

Do not duplicate rules with scattered checks such as `role === 'driver'` in `App.tsx`, the drawer, and individual screens.

## Navigation and screen guards

- The drawer must only display sections available to the current user.
- Protected screens must validate access when opened, including through deep links or direct navigation.
- A restricted screen must render an `UnauthorizedScreen` or redirect to an allowed destination.
- Returning to a previous screen must not expose data from the previous account or client.
- Permission state must be recalculated when the authenticated user changes.

Hiding a drawer item is not a security control. Direct navigation must be denied independently.

## Action-level controls

Use the centralized policy for every mutation action:

- Hide and disable client creation for passengers and clients.
- Hide and disable client editing and deletion for passengers and clients.
- Hide invitation creation and listing unless the user is a driver.
- Restrict summary status changes, payments, and deletion to permitted roles and clients.
- Prevent editing or operating on trips outside the user's permitted client scope.

The frontend must still handle a backend `403`, even when an action was hidden correctly.

## Client data isolation

- Do not treat the global `GET /clients` response as trusted authorization data.
- Display only clients returned for the current user's permitted scope.
- For passengers, use linked client IDs as the scope.
- For clients, use the authenticated client's own ID.
- Reset the selected client when the user changes.
- Clear client, trip, summary, and navigation caches during logout and account switching.
- Never merge cached data from two authenticated accounts.

## Calendar data isolation

- Load calendar data using the current client's permitted scope.
- Do not use `driver_id` as a substitute for client authorization.
- Do not display trips merely because they belong to the same driver.
- Clear old trips before loading data for a different user or client.
- Display an empty state when the user has no authorized trips.

## Central API error handling

The API client should handle errors consistently:

| Status | Frontend behavior |
|---|---|
| `401` | Clear the session and navigate to login. |
| `403` | Show a permission error and stop the mutation. Do not retry automatically. |
| `404` | Show that the resource does not exist or is no longer available. |
| `500` | Show a generic server error and preserve safe local state. |

Do not silently convert a `403` into an empty list, because that hides authorization defects.

## Required regression tests

- A passenger does not see the client creation action.
- A client does not see invitation creation or listing.
- A passenger sees only linked clients.
- A client sees only its own client context.
- A passenger cannot see trips belonging to another client.
- A restricted screen rejects direct navigation and deep links.
- A backend `403` prevents the requested action and shows an appropriate message.
- Logout clears user state, navigation state, and cached client/trip data.
- Switching accounts cannot display data cached by the previous account.

## Out of scope for frontend-only protection

Frontend guards cannot replace backend authorization. The backend must independently enforce:

- client ownership and role restrictions;
- invitation creation restrictions;
- trip filtering by authorized client IDs;
- summary and payment authorization;
- nested resource ownership.

## Acceptance criteria

- [ ] All role checks are defined in one permission policy.
- [ ] Drawer visibility and screen access use that policy.
- [ ] Every mutation action uses an explicit capability.
- [ ] Client and calendar data are scoped to the current user.
- [ ] `401` and `403` are handled by the shared API client.
- [ ] Logout and account switching clear protected cached data.
- [ ] Regression tests cover direct navigation and cross-client isolation.

# Convex API & Security

This document outlines the API functions available in the Convex backend and the security model used to protect them.

## Security Model (`guards.ts`)

Access control is enforced using helper functions in `convex/guards.ts`. These guards are called at the beginning of mutations and queries.

- **`requireSignedIn(ctx)`**: Ensures the request is from an authenticated user (via Clerk). Throws `ERR_AUTH_REQUIRED` if not.
- **`requireDiagramRole(ctx, diagramId, allowedRoles)`**: Ensures the authenticated user has a specific role (e.g., "owner", "editor") on the target diagram.
    - Checks if the user is the **owner** (direct check on `diagrams` table).
    - Checks if the user is a **member** with a matching role (via `diagramMembers` table).

## API Modules

### Diagrams (`convex/diagrams.ts`)

| Function | Type | Access Level | Description |
| :--- | :--- | :--- | :--- |
| `create` | Mutation | Authenticated | Creates a new diagram. The creator becomes the "owner". |
| `get` | Query | Member | Fetches a diagram by ID. Requires "viewer" role or higher. |
| `list` | Query | Authenticated | Lists all diagrams the user is a member of. |
| `update` | Mutation | Editor+ | Updates diagram content (tables, relationships, notes). Requires "editor" role or higher. |
| `deleteDiagram` | Mutation | Owner | Soft-deletes a diagram. Only the "owner" can perform this. |

### Users (`convex/users.ts`)

| Function | Type | Access Level | Description |
| :--- | :--- | :--- | :--- |
| `getMe` | Query | Authenticated | Returns the current user's profile. |
| `getUserByClerkId` | Query | Public | Fetches a user by their Clerk ID. |
| `createUser` | Internal Mutation | Admin/Webhook | Creates a new user. Called by Clerk webhooks. |
| `updateUser` | Internal Mutation | Admin/Webhook | Updates an existing user. Called by Clerk webhooks. |
| `deleteUser` | Internal Mutation | Admin/Webhook | Deletes a user. Called by Clerk webhooks. |

*Note: `internalMutation` functions are only accessible from within the Convex deployment (e.g., other actions or scheduling) and cannot be called directly from the client.*

# Convex Database Schema

The database schema is defined in `convex/schema.ts`. It includes tables for users, diagrams, memberships, and user preferences.

## Tables

### Users (`users`)

Manages user profiles and authentication data (linked to Clerk).

| Field | Type | Description |
| :--- | :--- | :--- |
| `clerkId` | `string` | Unique identifier from Clerk (indexed). |
| `email` | `string` | User's email address (indexed). |
| `firstName` | `string` | User's first name. |
| `lastName` | `string` (optional) | User's last name. |
| `imageUrl` | `string` (optional) | URL to user's profile image. |
| `credits` | `number` (optional) | Available credits. |
| `subscriptionId` | `string` (optional) | Stripe Subscription ID. |
| `subscriptionStatus` | `string` (optional) | Status (active, canceled, etc.). |
| `createdAt` | `number` | Timestamp of creation. |
| `updatedAt` | `number` (optional) | Timestamp of last update. |

**Indexes:**
- `by_clerk_id`: Lookup by Clerk ID.
- `by_email`: Lookup by email.

### Diagrams (`diagrams`)

Stores the core diagram data, including visual elements and metadata.

| Field | Type | Description |
| :--- | :--- | :--- |
| `ownerId` | `Id<"users">` | Reference to the creator (indexed). |
| `name` | `string` | Name of the diagram. |
| `publicId` | `string` (optional) | Public identifier for sharing (indexed). |
| `tables` | `array` | List of table objects (positions, columns, etc.). |
| `relationships` | `array` | List of relationship objects. |
| `areas` | `array` | List of visual groupings/areas. |
| `notes` | `array` | List of sticky notes. |
| `camera` | `object` | Camera position `{x, y, zoom}`. |
| `isDeleted` | `boolean` (optional) | Soft delete flag. |
| `createdAt` | `number` | Timestamp of creation. |
| `updatedAt` | `number` | Timestamp of last update. |

**Indexes:**
- `by_owner`: Lookup by owner ID.
- `by_publicId`: Lookup by public sharing ID.

### Diagram Members (`diagramMembers`)

Manages access control and collaboration roles.

| Field | Type | Description |
| :--- | :--- | :--- |
| `diagramId` | `Id<"diagrams">` | Reference to the diagram (indexed). |
| `userId` | `Id<"users">` | Reference to the user (indexed). |
| `role` | `string` | Role: "owner", "admin", "editor", "viewer". |
| `invitedAt` | `number` | Timestamp when invitation was sent. |
| `acceptedAt` | `number` (optional) | Timestamp when invitation was accepted. |

**Indexes:**
- `by_diagram`: List members of a diagram.
- `by_user`: List diagrams a user is a member of.
- `by_diagram_and_user`: Check specific membership.

### User Preferences (`userPreferences`)

Stores user-specific settings.

| Field | Type | Description |
| :--- | :--- | :--- |
| `userId` | `Id<"users">` | Reference to the user (indexed). |
| `theme` | `string` (optional) | UI theme preference. |
| `defaultView` | `string` (optional) | Default view mode. |
| `snapToGrid` | `boolean` (optional) | Snap to grid enabled. |
| `showGrid` | `boolean` (optional) | Grid visibility. |

**Indexes:**
- `by_user`: Lookup by user ID.

### Plans (`plans`)
Stores subscription plan definitions.

### Sandbox Sessions (`sandboxSessions`) & Events (`sandboxEvents`)
Tracks anonymous usage for analytics and temporary sessions.

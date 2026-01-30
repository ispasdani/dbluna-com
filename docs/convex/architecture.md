# Convex Architecture Overview

This document provides a high-level overview of the backend architecture for dbluna.com, built on [Convex](https://convex.dev/).

## Core Components

The backend consists of three main pillars:

1.  **Data Layer (Schema)**: A reactive, document-oriented database that stores user data, diagrams, and application state.
2.  **Logic Layer (Functions)**: Serverless functions (Queries, Mutations, Actions) that handle business logic and data access.
3.  **Security Layer (Auth & Guards)**: Integration with Clerk for authentication and custom authorization logic to protect resources.

## Data Flow

1.  **Client-Side**: The Next.js frontend uses Convex React hooks (`useQuery`, `useMutation`) to interact with the backend.
2.  **Authentication**: Requests are authenticated via Clerk. The `convex/auth.config.ts` file configures the issuer.
3.  **Authorization**: Functions use helper guards (in `convex/guards.ts`) to enforce permissions (e.g., `requireSignedIn`, `requireDiagramOwnerOrAdmin`).
4.  **Database Operations**: Mutations perform transactional updates (e.g., creating a diagram, updating a node position), while Queries provide real-time data subscriptions.

## Key Directories & Files

- `convex/schema.ts`: Defines the database schema, tables, and indexes.
- `convex/diagrams.ts`: specific logic for Diagram CRUD operations.
- `convex/users.ts`: User management (syncing with Clerk, profile updates).
- `convex/guards.ts`: Reusable authorization checks.
- `convex/auth.config.ts`: Auth configuration.

## Design Patterns

- **Optimistic Updates**: The frontend leverages Convex's optimistic updates for instant feedback on UI actions (like moving a node).
- **Single Source of Truth**: The Convex database is the authoritative state for all diagram data.
- **Idempotency**: User creation and updates are designed to be idempotent to handle webhook retries gracefully.

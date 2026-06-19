# NexusHQ API

NestJS backend for NexusHQ.

## Local commands

- `npm --workspace @nexushq/api run start:dev` starts the API in watch mode.
- `npm --workspace @nexushq/api run build` builds the API.
- `npm --workspace @nexushq/api run prisma:generate` generates the Prisma client.

The API uses the `/api` global prefix. The health endpoint is available at `/api/health`.

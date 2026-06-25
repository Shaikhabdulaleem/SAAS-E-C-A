import { Controller, Get } from '@nestjs/common';

@Controller('docs')
export class OpenApiController {
  @Get('openapi.json')
  spec() {
    return {
      openapi: '3.0.3',
      info: {
        title: 'NexusHQ API',
        version: '1.0.0',
      },
      servers: [{ url: '/api' }],
      security: [{ bearerAuth: [] }],
      components: {
        securitySchemes: {
          bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        },
      },
      tags: [
        'auth',
        'crm',
        'email',
        'cold-email',
        'finance',
        'billing',
        'dashboard',
        'notifications',
        'calls',
        'ai',
        'tenants',
        'providers',
      ].map((name) => ({ name })),
      paths: {
        '/auth/login': { post: { tags: ['auth'], summary: 'Login with email and password' } },
        '/auth/password-reset/request': { post: { tags: ['auth'], summary: 'Request a password reset token' } },
        '/auth/password-reset/confirm': { post: { tags: ['auth'], summary: 'Confirm password reset and revoke sessions' } },
        '/contacts/export.csv': { get: { tags: ['crm'], summary: 'Export contacts as CSV' } },
        '/contacts/bulk': { post: { tags: ['crm'], summary: 'Bulk update, tag, or delete contacts' } },
        '/contacts/merge': { post: { tags: ['crm'], summary: 'Merge duplicate contacts' } },
        '/activities/{id}': {
          patch: { tags: ['crm'], summary: 'Update an activity' },
          delete: { tags: ['crm'], summary: 'Delete an activity' },
        },
        '/email/campaigns/{campaignId}/duplicate': { post: { tags: ['email'], summary: 'Duplicate an email campaign' } },
        '/email/campaigns/{campaignId}/export-csv': { get: { tags: ['email'], summary: 'Export campaign recipients and metrics' } },
        '/email/campaigns/compare': { post: { tags: ['email'], summary: 'Compare campaign or A/B performance' } },
        '/cold-email/prospect-lists/{listId}/prospects': { post: { tags: ['cold-email'], summary: 'Bulk add prospects' } },
        '/cold-email/campaigns/{id}/analytics': { get: { tags: ['cold-email'], summary: 'Campaign analytics aggregation' } },
        '/finance/refunds': {
          get: { tags: ['finance'], summary: 'List refunds' },
          post: { tags: ['finance'], summary: 'Create a refund record' },
        },
        '/billing/refunds': { post: { tags: ['billing'], summary: 'Admin initiated billing refund' } },
        '/dashboard/overview': { get: { tags: ['dashboard'], summary: 'Dashboard overview with optional date range' } },
        '/dashboard/export.csv': { get: { tags: ['dashboard'], summary: 'Export dashboard summary as CSV' } },
        '/notifications/stream': { get: { tags: ['notifications'], summary: 'Server-sent notification stream' } },
        '/calls/sessions/search': { get: { tags: ['calls'], summary: 'Search call transcripts' } },
        '/calls/sessions/{id}': {
          patch: { tags: ['calls'], summary: 'Update call session metadata' },
          delete: { tags: ['calls'], summary: 'Delete a call session and recordings' },
        },
        '/ai/usage': { get: { tags: ['ai'], summary: 'AI token usage and cost visibility' } },
        '/health': { get: { tags: ['providers'], summary: 'Application and dependency health' } },
      },
    };
  }
}

import { BadRequestException, Injectable } from '@nestjs/common';
import { google } from 'googleapis';
import { EmailProviderType } from '@prisma/client';
import { ProviderLogsService } from './provider-logs.service';

export interface MailboxProvisionInput {
  tenantId: string;
  provider: EmailProviderType;
  email: string;
  firstName: string;
  lastName: string;
  adminEmail?: string;
  serviceAccountJson?: string;
  msTenantId?: string;
  clientId?: string;
  clientSecret?: string;
  temporaryPassword: string;
}

@Injectable()
export class MailboxProvisioningService {
  constructor(private readonly logs: ProviderLogsService) {}

  provision(input: MailboxProvisionInput) {
    if (input.provider === EmailProviderType.google_workspace) return this.createGoogleUser(input);
    return this.createMicrosoftUser(input);
  }

  private async createGoogleUser(input: MailboxProvisionInput) {
    if (!input.adminEmail || !input.serviceAccountJson) {
      throw new BadRequestException('Google Workspace credentials are incomplete');
    }

    const credentials = JSON.parse(input.serviceAccountJson);
    const auth = new google.auth.JWT({
      email: credentials.client_email,
      key: credentials.private_key,
      scopes: ['https://www.googleapis.com/auth/admin.directory.user'],
      subject: input.adminEmail,
    });
    const directory = google.admin({ version: 'directory_v1', auth });
    try {
      const result = await directory.users.insert({
        requestBody: {
          primaryEmail: input.email,
          name: { givenName: input.firstName, familyName: input.lastName },
          password: input.temporaryPassword,
          changePasswordAtNextLogin: true,
        },
      });
      const externalId = result.data.id ?? input.email;
      await this.logs.create({
        tenantId: input.tenantId,
        provider: 'google_workspace',
        operation: 'create_mailbox',
        status: 'success',
        requestId: externalId,
        request: { email: input.email },
        response: { id: externalId },
      });
      return { externalId };
    } catch (error) {
      await this.logs.create({
        tenantId: input.tenantId,
        provider: 'google_workspace',
        operation: 'create_mailbox',
        status: 'failed',
        request: { email: input.email },
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  private async createMicrosoftUser(input: MailboxProvisionInput) {
    if (!input.msTenantId || !input.clientId || !input.clientSecret) {
      throw new BadRequestException('Microsoft 365 credentials are incomplete');
    }

    const tokenResponse = await fetch(`https://login.microsoftonline.com/${input.msTenantId}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: input.clientId,
        client_secret: input.clientSecret,
        scope: 'https://graph.microsoft.com/.default',
        grant_type: 'client_credentials',
      }),
    });
    const tokenBody = await tokenResponse.json().catch(() => ({}));
    if (!tokenResponse.ok || !tokenBody.access_token) {
      await this.logs.create({
        tenantId: input.tenantId,
        provider: 'microsoft_365',
        operation: 'token',
        status: 'failed',
        request: { tenantId: input.msTenantId },
        response: tokenBody,
        error: JSON.stringify(tokenBody),
      });
      throw new BadRequestException('Microsoft 365 token request failed');
    }

    const response = await fetch('https://graph.microsoft.com/v1.0/users', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenBody.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        accountEnabled: true,
        displayName: `${input.firstName} ${input.lastName}`,
        mailNickname: input.email.split('@')[0],
        userPrincipalName: input.email,
        passwordProfile: {
          forceChangePasswordNextSignIn: true,
          password: input.temporaryPassword,
        },
      }),
    });
    const body = await response.json().catch(() => ({}));
    await this.logs.create({
      tenantId: input.tenantId,
      provider: 'microsoft_365',
      operation: 'create_mailbox',
      status: response.ok ? 'success' : 'failed',
      request: { email: input.email },
      response: body,
      error: response.ok ? undefined : JSON.stringify(body),
    });
    if (!response.ok) throw new BadRequestException('Microsoft 365 mailbox creation failed');
    return { externalId: body.id ?? input.email };
  }
}

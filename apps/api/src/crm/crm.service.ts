import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ContactSource, ContactStatus, DealStatus, Prisma } from '@prisma/client';
import { google } from 'googleapis';
import { PrismaService } from '../prisma/prisma.service';

type ImportMapping = {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  jobTitle?: string;
  company?: string;
  status?: string;
  tags?: string;
  marketingConsent?: string;
  marketingConsentSource?: string;
};

type ImportRow = Record<string, unknown>;

type NormalizedImportRow = {
  rowNumber: number;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  jobTitle?: string;
  companyName?: string;
  status: ContactStatus;
  tags: string[];
  marketingConsent: boolean;
  marketingConsentSource?: string;
  provided: {
    firstName: boolean;
    lastName: boolean;
    phone: boolean;
    jobTitle: boolean;
    company: boolean;
    status: boolean;
    tags: boolean;
  };
};

@Injectable()
export class CrmService {
  constructor(private readonly prisma: PrismaService) {}

  listContacts(tenantId: string, query: Record<string, string>) {
    const where: Prisma.ContactWhereInput = {
      tenantId,
      ...(query.status ? { status: query.status as ContactStatus } : {}),
      ...(query.q ? {
        OR: [
          { firstName: { contains: query.q, mode: 'insensitive' } },
          { lastName: { contains: query.q, mode: 'insensitive' } },
          { email: { contains: query.q, mode: 'insensitive' } },
        ],
      } : {}),
    };
    return this.prisma.contact.findMany({ where, orderBy: { createdAt: 'desc' }, ...this.page(query) });
  }

  createContact(tenantId: string, actorUserId: string, body: Record<string, unknown>) {
    return this.prisma.$transaction(async (tx) => {
      const contact = await tx.contact.create({
        data: {
          tenantId,
          firstName: this.requiredString(body.firstName, 'firstName'),
          lastName: this.requiredString(body.lastName, 'lastName'),
          email: this.requiredString(body.email, 'email').toLowerCase(),
          phone: this.optionalString(body.phone),
          jobTitle: this.optionalString(body.jobTitle),
          companyId: this.optionalString(body.companyId),
          assignedTo: this.optionalString(body.assignedTo),
          status: this.optionalEnum(body.status, Object.values(ContactStatus), ContactStatus.lead),
          source: this.optionalEnum(body.source, Object.values(ContactSource), ContactSource.manual),
          tags: this.stringArray(body.tags),
          marketingConsent: this.optionalBoolean(body.marketingConsent, false),
          marketingConsentSource: this.optionalString(body.marketingConsentSource),
          marketingConsentCapturedAt: this.optionalBoolean(body.marketingConsent, false) ? new Date() : undefined,
        },
      });
      await this.completeImportOnboarding(tenantId);
      await this.logActivity(tx, tenantId, actorUserId, 'contact_created', `Created contact ${contact.firstName} ${contact.lastName}`, { contactId: contact.id, companyId: contact.companyId });
      return contact;
    });
  }

  async getContact(tenantId: string, id: string) {
    const contact = await this.prisma.contact.findFirst({ where: { tenantId, id } });
    if (!contact) throw new NotFoundException('Contact not found');
    return contact;
  }

  async updateContact(tenantId: string, actorUserId: string, id: string, body: Record<string, unknown>) {
    await this.getContact(tenantId, id);
    return this.prisma.$transaction(async (tx) => {
      const contact = await tx.contact.update({
        where: { id },
        data: {
          firstName: this.optionalString(body.firstName),
          lastName: this.optionalString(body.lastName),
          email: typeof body.email === 'string' ? body.email.toLowerCase() : undefined,
          phone: this.optionalString(body.phone),
          jobTitle: this.optionalString(body.jobTitle),
          companyId: this.optionalString(body.companyId),
          assignedTo: this.optionalString(body.assignedTo),
          status: this.optionalEnum(body.status, Object.values(ContactStatus)),
          source: this.optionalEnum(body.source, Object.values(ContactSource)),
          tags: Array.isArray(body.tags) ? this.stringArray(body.tags) : undefined,
          marketingConsent: this.optionalBoolean(body.marketingConsent),
          marketingConsentSource: this.optionalString(body.marketingConsentSource),
          marketingConsentCapturedAt: body.marketingConsent === true || body.marketingConsent === 'true' ? new Date() : body.marketingConsent === false || body.marketingConsent === 'false' ? null : undefined,
          lastActivityAt: new Date(),
        },
      });
      await this.logActivity(tx, tenantId, actorUserId, 'contact_updated', `Updated contact ${contact.firstName} ${contact.lastName}`, { contactId: id, companyId: contact.companyId });
      return contact;
    });
  }

  async deleteContact(tenantId: string, id: string) {
    await this.getContact(tenantId, id);
    await this.prisma.contact.delete({ where: { id } });
    return { success: true };
  }

  async previewContactImport(tenantId: string, body: Record<string, unknown>) {
    const input = this.parseImportInput(body);
    return this.buildImportPreview(tenantId, input.rows, input.mapping);
  }

  async importContacts(tenantId: string, actorUserId: string, body: Record<string, unknown>) {
    const input = this.parseImportInput(body);
    const preview = await this.buildImportPreview(tenantId, input.rows, input.mapping);
    const validRows = preview.rows.filter((row) => row.valid).map((row) => row.normalized);
    let created = 0;
    let updated = 0;

    for (const row of validRows) {
      const companyId = row.companyName ? await this.ensureCompany(tenantId, actorUserId, row.companyName) : undefined;
      const existing = await this.prisma.contact.findUnique({ where: { tenantId_email: { tenantId, email: row.email } } });
      await this.prisma.contact.upsert({
        where: { tenantId_email: { tenantId, email: row.email } },
        create: {
          tenantId,
          firstName: row.firstName,
          lastName: row.lastName,
          email: row.email,
          phone: row.phone,
          jobTitle: row.jobTitle,
          companyId,
          status: row.status,
          source: ContactSource.import,
          tags: row.tags,
          marketingConsent: row.marketingConsent,
          marketingConsentSource: row.marketingConsentSource,
          marketingConsentCapturedAt: row.marketingConsent ? new Date() : undefined,
        },
        update: {
          firstName: row.provided.firstName ? row.firstName : undefined,
          lastName: row.provided.lastName ? row.lastName : undefined,
          phone: row.provided.phone ? row.phone : undefined,
          jobTitle: row.provided.jobTitle ? row.jobTitle : undefined,
          companyId,
          status: row.provided.status ? row.status : undefined,
          source: ContactSource.import,
          tags: row.provided.tags ? row.tags : undefined,
          marketingConsent: row.marketingConsent,
          marketingConsentSource: row.marketingConsentSource,
          marketingConsentCapturedAt: row.marketingConsent ? new Date() : undefined,
          lastActivityAt: new Date(),
        },
      });
      if (existing) updated++; else created++;
    }

    await this.completeImportOnboarding(tenantId);
    await this.createActivity(tenantId, actorUserId, {
      type: 'contacts_imported',
      subject: `Imported ${validRows.length} contacts`,
      createdBy: actorUserId,
    });

    return {
      created,
      updated,
      skipped: preview.summary.invalid,
      duplicates: preview.summary.duplicates,
      totalRows: preview.summary.totalRows,
      marketable: preview.summary.marketable,
    };
  }

  async previewGoogleSheetsImport(tenantId: string, body: Record<string, unknown>) {
    const rows = await this.fetchGoogleSheetRows(body);
    const mapping = this.mapping(body.mapping);
    return this.buildImportPreview(tenantId, rows, mapping);
  }

  async importGoogleSheetsContacts(tenantId: string, actorUserId: string, body: Record<string, unknown>) {
    const rows = await this.fetchGoogleSheetRows(body);
    return this.importContacts(tenantId, actorUserId, { rows, mapping: body.mapping });
  }

  async audiencePreview(tenantId: string, body: Record<string, unknown>) {
    const filter = this.normalizeAudienceFilter(body.recipientFilter);
    const contacts = await this.findMarketableContacts(tenantId, filter, 5000);
    const suppressed = await this.prisma.suppressionEntry.findMany({
      where: { tenantId, email: { in: contacts.map((contact) => contact.email.toLowerCase()) } },
      select: { email: true },
    });
    const suppressedEmails = new Set(suppressed.map((item) => item.email.toLowerCase()));
    const allowed = contacts.filter((contact) => !suppressedEmails.has(contact.email.toLowerCase()));
    return {
      total: contacts.length,
      suppressed: contacts.length - allowed.length,
      allowed: allowed.length,
      sample: allowed.slice(0, 10),
    };
  }

  listCompanies(tenantId: string, query: Record<string, string>) {
    const where: Prisma.CompanyWhereInput = {
      tenantId,
      ...(query.q ? { OR: [{ name: { contains: query.q, mode: 'insensitive' } }, { domain: { contains: query.q, mode: 'insensitive' } }] } : {}),
    };
    return this.prisma.company.findMany({ where, orderBy: { createdAt: 'desc' }, ...this.page(query) });
  }

  createCompany(tenantId: string, actorUserId: string, body: Record<string, unknown>) {
    return this.prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: {
          tenantId,
          name: this.requiredString(body.name, 'name'),
          domain: this.optionalString(body.domain),
          industry: this.optionalString(body.industry),
          size: this.optionalString(body.size),
          website: this.optionalString(body.website),
          phone: this.optionalString(body.phone),
          assignedTo: this.optionalString(body.assignedTo),
          tags: this.stringArray(body.tags),
        },
      });
      await this.logActivity(tx, tenantId, actorUserId, 'company_created', `Created company ${company.name}`, { companyId: company.id });
      return company;
    });
  }

  async getCompany(tenantId: string, id: string) {
    const company = await this.prisma.company.findFirst({ where: { tenantId, id } });
    if (!company) throw new NotFoundException('Company not found');
    return company;
  }

  async updateCompany(tenantId: string, actorUserId: string, id: string, body: Record<string, unknown>) {
    await this.getCompany(tenantId, id);
    return this.prisma.$transaction(async (tx) => {
      const company = await tx.company.update({
        where: { id },
        data: {
          name: this.optionalString(body.name),
          domain: this.optionalString(body.domain),
          industry: this.optionalString(body.industry),
          size: this.optionalString(body.size),
          website: this.optionalString(body.website),
          phone: this.optionalString(body.phone),
          assignedTo: this.optionalString(body.assignedTo),
          tags: Array.isArray(body.tags) ? this.stringArray(body.tags) : undefined,
        },
      });
      await this.logActivity(tx, tenantId, actorUserId, 'company_updated', `Updated company ${company.name}`, { companyId: id });
      return company;
    });
  }

  async deleteCompany(tenantId: string, id: string) {
    await this.getCompany(tenantId, id);
    await this.prisma.company.delete({ where: { id } });
    return { success: true };
  }

  listDeals(tenantId: string, query: Record<string, string>) {
    const where: Prisma.DealWhereInput = {
      tenantId,
      ...(query.status ? { status: query.status as DealStatus } : {}),
      ...(query.stage ? { stage: query.stage } : {}),
      ...(query.q ? { title: { contains: query.q, mode: 'insensitive' } } : {}),
    };
    return this.prisma.deal.findMany({ where, orderBy: { createdAt: 'desc' }, ...this.page(query) });
  }

  createDeal(tenantId: string, actorUserId: string, body: Record<string, unknown>) {
    return this.prisma.$transaction(async (tx) => {
      const deal = await tx.deal.create({
        data: {
          tenantId,
          title: this.requiredString(body.title, 'title'),
          value: this.optionalNumber(body.value, 0) ?? 0,
          currency: this.optionalString(body.currency) ?? 'USD',
          stage: this.requiredString(body.stage, 'stage'),
          companyId: this.optionalString(body.companyId),
          assignedTo: this.requiredString(body.assignedTo, 'assignedTo'),
          status: this.optionalEnum(body.status, Object.values(DealStatus), DealStatus.open),
          probability: this.optionalNumber(body.probability, 0) ?? 0,
          expectedCloseDate: typeof body.expectedCloseDate === 'string' ? new Date(body.expectedCloseDate) : undefined,
        },
      });
      await this.logActivity(tx, tenantId, actorUserId, 'deal_created', `Created deal ${deal.title}`, { dealId: deal.id, companyId: deal.companyId });
      return deal;
    });
  }

  async getDeal(tenantId: string, id: string) {
    const deal = await this.prisma.deal.findFirst({ where: { tenantId, id } });
    if (!deal) throw new NotFoundException('Deal not found');
    return deal;
  }

  async updateDeal(tenantId: string, actorUserId: string, id: string, body: Record<string, unknown>) {
    await this.getDeal(tenantId, id);
    return this.prisma.$transaction(async (tx) => {
      const deal = await tx.deal.update({
        where: { id },
        data: {
          title: this.optionalString(body.title),
          value: this.optionalNumber(body.value),
          currency: this.optionalString(body.currency),
          stage: this.optionalString(body.stage),
          companyId: this.optionalString(body.companyId),
          assignedTo: this.optionalString(body.assignedTo),
          status: this.optionalEnum(body.status, Object.values(DealStatus)),
          probability: this.optionalNumber(body.probability),
          expectedCloseDate: typeof body.expectedCloseDate === 'string' ? new Date(body.expectedCloseDate) : undefined,
        },
      });
      await this.logActivity(tx, tenantId, actorUserId, 'deal_updated', `Updated deal ${deal.title}`, { dealId: id, companyId: deal.companyId });
      return deal;
    });
  }

  async deleteDeal(tenantId: string, id: string) {
    await this.getDeal(tenantId, id);
    await this.prisma.deal.delete({ where: { id } });
    return { success: true };
  }

  listActivities(tenantId: string, query: Record<string, string>) {
    return this.prisma.activity.findMany({
      where: {
        tenantId,
        contactId: query.contactId,
        companyId: query.companyId,
        dealId: query.dealId,
      },
      orderBy: { createdAt: 'desc' },
      ...this.page(query),
    });
  }

  createActivity(tenantId: string, actorUserId: string, body: Record<string, unknown>) {
    return this.prisma.activity.create({
      data: {
        tenantId,
        type: this.requiredString(body.type, 'type'),
        subject: this.requiredString(body.subject, 'subject'),
        body: this.optionalString(body.body),
        contactId: this.optionalString(body.contactId),
        companyId: this.optionalString(body.companyId),
        dealId: this.optionalString(body.dealId),
        createdBy: this.optionalString(body.createdBy) ?? actorUserId,
      },
    });
  }

  // Pipeline Stages

  listPipelineStages(tenantId: string) {
    return this.prisma.pipelineStage.findMany({ where: { tenantId }, orderBy: { order: 'asc' } });
  }

  createPipelineStage(tenantId: string, body: Record<string, unknown>) {
    return this.prisma.pipelineStage.create({
      data: {
        tenantId,
        name: this.requiredString(body.name, 'name'),
        order: this.optionalNumber(body.order, 0) ?? 0,
        color: this.optionalString(body.color),
      },
    });
  }

  async updatePipelineStage(tenantId: string, id: string, body: Record<string, unknown>) {
    const stage = await this.prisma.pipelineStage.findFirst({ where: { tenantId, id } });
    if (!stage) throw new NotFoundException('Pipeline stage not found');
    return this.prisma.pipelineStage.update({
      where: { id },
      data: {
        name: this.optionalString(body.name),
        order: this.optionalNumber(body.order),
        color: this.optionalString(body.color),
      },
    });
  }

  async deletePipelineStage(tenantId: string, id: string) {
    const stage = await this.prisma.pipelineStage.findFirst({ where: { tenantId, id } });
    if (!stage) throw new NotFoundException('Pipeline stage not found');
    await this.prisma.pipelineStage.delete({ where: { id } });
    return { success: true };
  }

  async reorderPipelineStages(tenantId: string, body: Record<string, unknown>) {
    const stageIds = body.stageIds;
    if (!Array.isArray(stageIds)) throw new BadRequestException('stageIds array is required');
    for (let i = 0; i < stageIds.length; i++) {
      await this.prisma.pipelineStage.updateMany({
        where: { tenantId, id: String(stageIds[i]) },
        data: { order: i },
      });
    }
    return this.listPipelineStages(tenantId);
  }

  // Tags

  listTags(tenantId: string) {
    return this.prisma.tag.findMany({ where: { tenantId }, orderBy: { name: 'asc' } });
  }

  createTag(tenantId: string, body: Record<string, unknown>) {
    return this.prisma.tag.create({
      data: {
        tenantId,
        name: this.requiredString(body.name, 'name'),
        color: this.optionalString(body.color),
      },
    });
  }

  async updateTag(tenantId: string, id: string, body: Record<string, unknown>) {
    const tag = await this.prisma.tag.findFirst({ where: { tenantId, id } });
    if (!tag) throw new NotFoundException('Tag not found');
    return this.prisma.tag.update({
      where: { id },
      data: {
        name: this.optionalString(body.name),
        color: this.optionalString(body.color),
      },
    });
  }

  async deleteTag(tenantId: string, id: string) {
    const tag = await this.prisma.tag.findFirst({ where: { tenantId, id } });
    if (!tag) throw new NotFoundException('Tag not found');
    await this.prisma.tag.delete({ where: { id } });
    return { success: true };
  }

  private parseImportInput(body: Record<string, unknown>) {
    const mapping = this.mapping(body.mapping);
    const rows = Array.isArray(body.rows)
      ? body.rows.filter((row): row is ImportRow => !!row && typeof row === 'object' && !Array.isArray(row))
      : this.parseDelimitedText(this.requiredString(body.csvText, 'csvText'));
    if (!rows.length) throw new BadRequestException('At least one contact row is required');
    return { rows, mapping };
  }

  private async buildImportPreview(tenantId: string, rows: ImportRow[], mapping: ImportMapping) {
    const emails = rows
      .map((row) => this.normalizeImportRow(row, mapping, 0).email)
      .filter(Boolean);
    const existing = await this.prisma.contact.findMany({
      where: { tenantId, email: { in: emails } },
      select: { email: true },
    });
    const existingEmails = new Set(existing.map((contact) => contact.email.toLowerCase()));
    const seenEmails = new Set<string>();
    const previewRows = rows.map((row, index) => {
      const normalized = this.normalizeImportRow(row, mapping, index + 2);
      const errors: string[] = [];
      if (!normalized.email) errors.push('Missing email');
      if (normalized.email && !this.validEmail(normalized.email)) errors.push('Invalid email');
      if (!normalized.marketingConsent) errors.push('Missing marketing consent');
      const duplicateInFile = !!normalized.email && seenEmails.has(normalized.email);
      if (duplicateInFile) errors.push('Duplicate in file');
      if (normalized.email) seenEmails.add(normalized.email);
      return {
        rowNumber: normalized.rowNumber,
        valid: errors.length === 0,
        duplicate: duplicateInFile || existingEmails.has(normalized.email),
        existing: existingEmails.has(normalized.email),
        errors,
        normalized,
      };
    });
    return {
      headers: Object.keys(rows[0] ?? {}),
      rows: previewRows,
      summary: {
        totalRows: previewRows.length,
        valid: previewRows.filter((row) => row.valid).length,
        invalid: previewRows.filter((row) => !row.valid).length,
        duplicates: previewRows.filter((row) => row.duplicate).length,
        missingConsent: previewRows.filter((row) => row.errors.includes('Missing marketing consent')).length,
        marketable: previewRows.filter((row) => row.valid && row.normalized.marketingConsent).length,
      },
    };
  }

  private normalizeImportRow(row: ImportRow, mapping: ImportMapping, rowNumber: number): NormalizedImportRow {
    const get = (field: keyof ImportMapping) => this.cell(row, mapping[field]);
    const fullName = this.cell(row, 'name') || this.cell(row, 'fullName') || '';
    const [fallbackFirst, ...fallbackLast] = fullName.split(/\s+/).filter(Boolean);
    const email = get('email').toLowerCase();
    const consentSource = get('marketingConsentSource') || 'import';
    const firstName = get('firstName');
    const lastName = get('lastName');
    const status = get('status');
    const tags = get('tags');
    return {
      rowNumber,
      firstName: firstName || fallbackFirst || 'Unknown',
      lastName: lastName || fallbackLast.join(' ') || '-',
      email,
      phone: get('phone') || undefined,
      jobTitle: get('jobTitle') || undefined,
      companyName: get('company') || undefined,
      status: this.contactStatus(status),
      tags: this.splitTags(tags),
      marketingConsent: this.truthy(get('marketingConsent')),
      marketingConsentSource: consentSource,
      provided: {
        firstName: !!firstName || !!fallbackFirst,
        lastName: !!lastName || fallbackLast.length > 0,
        phone: !!get('phone'),
        jobTitle: !!get('jobTitle'),
        company: !!get('company'),
        status: !!status,
        tags: !!tags,
      },
    };
  }

  private mapping(value: unknown): ImportMapping {
    const raw = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
    return {
      firstName: this.stringOrDefault(raw.firstName, 'firstName'),
      lastName: this.stringOrDefault(raw.lastName, 'lastName'),
      email: this.stringOrDefault(raw.email, 'email'),
      phone: this.stringOrDefault(raw.phone, 'phone'),
      jobTitle: this.stringOrDefault(raw.jobTitle, 'jobTitle'),
      company: this.stringOrDefault(raw.company, 'company'),
      status: this.stringOrDefault(raw.status, 'status'),
      tags: this.stringOrDefault(raw.tags, 'tags'),
      marketingConsent: this.stringOrDefault(raw.marketingConsent, 'marketingConsent'),
      marketingConsentSource: this.stringOrDefault(raw.marketingConsentSource, 'marketingConsentSource'),
    };
  }

  private parseDelimitedText(text: string): ImportRow[] {
    const delimiter = text.includes('\t') ? '\t' : ',';
    const rows = this.parseRows(text, delimiter).filter((row) => row.some((cell) => cell.trim()));
    const headers = rows.shift()?.map((cell) => this.normalizeHeader(cell)) ?? [];
    if (!headers.length) return [];
    return rows.map((cells) => Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ''])));
  }

  private parseRows(text: string, delimiter: string) {
    const rows: string[][] = [];
    let row: string[] = [];
    let cell = '';
    let quoted = false;
    for (let index = 0; index < text.length; index++) {
      const char = text[index];
      const next = text[index + 1];
      if (char === '"' && quoted && next === '"') {
        cell += '"';
        index++;
      } else if (char === '"') {
        quoted = !quoted;
      } else if (char === delimiter && !quoted) {
        row.push(cell.trim());
        cell = '';
      } else if ((char === '\n' || char === '\r') && !quoted) {
        if (char === '\r' && next === '\n') index++;
        row.push(cell.trim());
        rows.push(row);
        row = [];
        cell = '';
      } else {
        cell += char;
      }
    }
    row.push(cell.trim());
    rows.push(row);
    return rows;
  }

  private async fetchGoogleSheetRows(body: Record<string, unknown>) {
    const spreadsheetId = this.extractSpreadsheetId(this.requiredString(body.sheetUrl, 'sheetUrl'));
    const worksheet = this.optionalString(body.worksheet) ?? 'Sheet1';
    const serviceEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n');
    if (!serviceEmail || !privateKey) {
      throw new BadRequestException('Google Sheets service account is not configured');
    }
    const auth = new google.auth.JWT({
      email: serviceEmail,
      key: privateKey,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
    const sheets = google.sheets({ version: 'v4', auth });
    const result = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: worksheet,
    });
    const values = result.data.values ?? [];
    if (!values.length) throw new BadRequestException('Google Sheet has no rows');
    const headers = values[0].map((cell) => this.normalizeHeader(String(cell ?? '')));
    return values.slice(1).map((cells) => Object.fromEntries(headers.map((header, index) => [header, String(cells[index] ?? '')])));
  }

  private extractSpreadsheetId(sheetUrl: string) {
    const match = sheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/) ?? sheetUrl.match(/^([a-zA-Z0-9-_]{20,})$/);
    if (!match) throw new BadRequestException('Invalid Google Sheet URL');
    return match[1];
  }

  private normalizeAudienceFilter(value: unknown) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return { mode: 'all' };
    const raw = value as Record<string, unknown>;
    return {
      mode: raw.mode === 'manual' ? 'manual' : 'all',
      contactIds: Array.isArray(raw.contactIds) ? raw.contactIds.filter((item): item is string => typeof item === 'string') : undefined,
      statuses: Array.isArray(raw.statuses) ? raw.statuses.filter((item): item is string => typeof item === 'string') : undefined,
      tags: Array.isArray(raw.tags) ? raw.tags.filter((item): item is string => typeof item === 'string') : undefined,
      companyId: this.optionalString(raw.companyId),
    };
  }

  private async findMarketableContacts(tenantId: string, filter: ReturnType<CrmService['normalizeAudienceFilter']>, take: number) {
    const where: Prisma.ContactWhereInput = { tenantId, marketingConsent: true };
    if (filter.mode === 'manual' && filter.contactIds?.length) where.id = { in: filter.contactIds };
    const statuses = filter.statuses?.filter((status): status is ContactStatus => Object.values(ContactStatus).includes(status as ContactStatus));
    if (statuses?.length) where.status = { in: statuses };
    if (filter.tags?.length) where.tags = { hasSome: filter.tags };
    if (filter.companyId) where.companyId = filter.companyId;
    return this.prisma.contact.findMany({ where, orderBy: { createdAt: 'desc' }, take });
  }

  private async ensureCompany(tenantId: string, actorUserId: string, name: string) {
    const existing = await this.prisma.company.findFirst({ where: { tenantId, name } });
    if (existing) return existing.id;
    const company = await this.prisma.company.create({
      data: { tenantId, name, tags: [], assignedTo: actorUserId },
    });
    return company.id;
  }

  private completeImportOnboarding(tenantId: string) {
    return this.prisma.onboardingItem.upsert({
      where: { tenantId_key: { tenantId, key: 'import_crm_data' } },
      create: { tenantId, key: 'import_crm_data', label: 'Import CRM data', completedAt: new Date() },
      update: { completedAt: new Date() },
    }).catch(() => undefined);
  }

  private logActivity(tx: Prisma.TransactionClient, tenantId: string, actorUserId: string, type: string, subject: string, links: { contactId?: string; companyId?: string | null; dealId?: string }) {
    return tx.activity.create({
      data: {
        tenantId,
        type,
        subject,
        contactId: links.contactId,
        companyId: links.companyId ?? undefined,
        dealId: links.dealId,
        createdBy: actorUserId,
      },
    });
  }

  private page(query: Record<string, string>) {
    const page = Math.max(Number(query.page ?? 1), 1);
    const pageSize = Math.min(Math.max(Number(query.pageSize ?? 50), 1), 100);
    return { skip: (page - 1) * pageSize, take: pageSize };
  }

  private requiredString(value: unknown, field: string) {
    if (typeof value !== 'string' || value.trim().length === 0) throw new BadRequestException(`${field} is required`);
    return value.trim();
  }

  private optionalString(value: unknown) {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
  }

  private optionalNumber(value: unknown, fallback?: number) {
    if (value === undefined || value === null || value === '') return fallback;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) throw new BadRequestException('Invalid number value');
    return parsed;
  }

  private optionalEnum<T extends string>(value: unknown, allowed: T[], fallback?: T) {
    if (value === undefined || value === null || value === '') return fallback;
    if (!allowed.includes(value as T)) throw new BadRequestException('Invalid enum value');
    return value as T;
  }

  private stringArray(value: unknown) {
    return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
  }

  private optionalBoolean(value: unknown, fallback?: boolean) {
    if (value === undefined || value === null || value === '') return fallback;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') return this.truthy(value);
    return fallback;
  }

  private truthy(value: string) {
    return ['true', 'yes', 'y', '1', 'opted in', 'opt-in', 'subscribed', 'consent'].includes(value.trim().toLowerCase());
  }

  private contactStatus(value: string) {
    const normalized = value.trim().toLowerCase();
    return Object.values(ContactStatus).includes(normalized as ContactStatus) ? normalized as ContactStatus : ContactStatus.customer;
  }

  private splitTags(value: string) {
    return value.split(/[;,]/).map((tag) => tag.trim()).filter(Boolean);
  }

  private cell(row: ImportRow, key?: string) {
    if (!key) return '';
    const normalizedKey = this.normalizeHeader(key);
    const match = Object.entries(row).find(([candidate]) => this.normalizeHeader(candidate) === normalizedKey);
    return match ? String(match[1] ?? '').trim() : '';
  }

  private normalizeHeader(value: string) {
    return value.trim().replace(/^\uFEFF/, '').replace(/[^a-zA-Z0-9]+(.)/g, (_m, chr: string) => chr.toUpperCase()).replace(/^[A-Z]/, (chr) => chr.toLowerCase());
  }

  private stringOrDefault(value: unknown, fallback: string) {
    return typeof value === 'string' && value.trim() ? value.trim() : fallback;
  }

  private validEmail(value: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }
}

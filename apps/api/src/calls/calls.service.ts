import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TranscriptionService } from '../providers/services/transcription.service';

@Injectable()
export class CallsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly transcription: TranscriptionService,
  ) {}

  list(tenantId: string, query: Record<string, string>) {
    return this.prisma.callSession.findMany({
      where: { tenantId, ...(query.status ? { status: query.status as never } : {}) },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(Number(query.pageSize ?? 50), 1), 100),
    });
  }

  createSession(tenantId: string, userId: string, body: Record<string, unknown>) {
    return this.prisma.callSession.create({
      data: {
        tenantId,
        userId,
        title: this.requiredString(body.title, 'title'),
        provider: this.optionalString(body.provider),
        providerCallId: this.optionalString(body.providerCallId),
        contactId: this.optionalString(body.contactId),
        dealId: this.optionalString(body.dealId),
        startedAt: this.optionalDate(body.startedAt),
        endedAt: this.optionalDate(body.endedAt),
        durationSec: this.optionalNumber(body.durationSec),
      },
    });
  }

  async get(tenantId: string, id: string) {
    const session = await this.prisma.callSession.findFirst({
      where: { tenantId, id },
      include: { recordings: true, transcripts: true, insights: { orderBy: { createdAt: 'desc' } } },
    });
    if (!session) throw new NotFoundException('Call session not found');
    return session;
  }

  async addRecording(tenantId: string, sessionId: string, body: Record<string, unknown>) {
    await this.ensureSession(tenantId, sessionId);
    return this.prisma.callRecording.create({
      data: {
        tenantId,
        sessionId,
        storageUrl: this.requiredString(body.storageUrl, 'storageUrl'),
        mimeType: this.optionalString(body.mimeType),
        durationSec: this.optionalNumber(body.durationSec),
      },
    });
  }

  async addTranscript(tenantId: string, sessionId: string, body: Record<string, unknown>) {
    await this.ensureSession(tenantId, sessionId);
    const transcript = await this.prisma.callTranscript.create({
      data: {
        tenantId,
        sessionId,
        provider: this.optionalString(body.provider) ?? 'manual',
        language: this.optionalString(body.language),
        text: this.requiredString(body.text, 'text'),
        speakerLabels: this.json(body.speakerLabels),
      },
    });
    await this.prisma.callSession.update({ where: { id: sessionId }, data: { status: 'transcribed' } });
    return transcript;
  }

  async summarize(tenantId: string, userId: string, sessionId: string) {
    await this.ensureSession(tenantId, sessionId);
    const transcript = await this.prisma.callTranscript.findFirst({ where: { tenantId, sessionId }, orderBy: { createdAt: 'desc' } });
    if (!transcript) throw new BadRequestException('Transcript is required before summarizing');
    const result = await this.transcription.summarize({ tenantId, userId, transcript: transcript.text });
    const insight = await this.prisma.callInsight.create({
      data: {
        tenantId,
        sessionId,
        summary: result.summary,
        objections: result.objections as Prisma.InputJsonValue,
        actionItems: result.actionItems as Prisma.InputJsonValue,
        sentiment: result.sentiment,
        coachingScore: result.coachingScore,
        followUpEmail: result.followUpEmail,
        model: result.model,
        tokens: result.tokens,
      },
    });
    await this.prisma.$transaction([
      this.prisma.callSession.update({ where: { id: sessionId }, data: { status: 'summarized' } }),
      this.prisma.aiUsageEvent.create({ data: { tenantId, userId, action: 'call_summary', model: result.model, tokens: result.tokens } }),
    ]);
    return insight;
  }

  async insights(tenantId: string, sessionId: string) {
    await this.ensureSession(tenantId, sessionId);
    return this.prisma.callInsight.findMany({ where: { tenantId, sessionId }, orderBy: { createdAt: 'desc' } });
  }

  private async ensureSession(tenantId: string, id: string) {
    const session = await this.prisma.callSession.findFirst({ where: { tenantId, id } });
    if (!session) throw new NotFoundException('Call session not found');
    return session;
  }

  private requiredString(value: unknown, field: string) {
    if (typeof value !== 'string' || !value.trim()) throw new BadRequestException(`${field} is required`);
    return value.trim();
  }

  private optionalString(value: unknown) {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
  }

  private optionalNumber(value: unknown) {
    if (value === undefined || value === null || value === '') return undefined;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) throw new BadRequestException('Invalid number value');
    return parsed;
  }

  private optionalDate(value: unknown) {
    if (typeof value !== 'string' || !value.trim()) return undefined;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) throw new BadRequestException('Invalid date value');
    return parsed;
  }

  private json(value: unknown): Prisma.InputJsonValue | undefined {
    return value === undefined ? undefined : value as Prisma.InputJsonValue;
  }
}

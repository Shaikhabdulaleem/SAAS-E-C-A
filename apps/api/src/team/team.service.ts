import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { InviteStatus, TenantMemberRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { JobsService } from '../providers/services/jobs.service';

@Injectable()
export class TeamService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jobs: JobsService,
  ) {}

  members(tenantId: string) {
    return this.prisma.tenantUser.findMany({
      where: { tenantId },
      include: { user: { select: { id: true, name: true, email: true, role: true, initials: true, createdAt: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  invites(tenantId: string) {
    return this.prisma.tenantInvite.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createInvite(tenantId: string, actorUserId: string, body: Record<string, unknown>) {
    await this.enforceSeatLimit(tenantId);
    const email = this.requiredString(body.email, 'email').toLowerCase();
    const role = this.role(body.role);
    const token = randomBytes(32).toString('hex');
    const invite = await this.prisma.tenantInvite.create({
      data: {
        tenantId,
        email,
        role,
        tokenHash: this.hash(token),
        invitedByUserId: actorUserId,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
      },
    });
    await this.prisma.auditLog.create({ data: { actorUserId, tenantId, event: 'team.invite.created', metadata: { email, role } } });
    await this.jobs.enqueue({
      tenantId,
      queue: 'notifications',
      name: 'team.invite.email',
      payload: { inviteId: invite.id, token, email },
    });
    return { ...invite, token };
  }

  async resendInvite(tenantId: string, inviteId: string, actorUserId: string) {
    const invite = await this.findInvite(tenantId, inviteId);
    if (invite.status !== InviteStatus.pending) throw new BadRequestException('Only pending invites can be resent');
    const token = randomBytes(32).toString('hex');
    const updated = await this.prisma.tenantInvite.update({
      where: { id: inviteId },
      data: { tokenHash: this.hash(token), expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7) },
    });
    await this.prisma.auditLog.create({ data: { actorUserId, tenantId, event: 'team.invite.resent', metadata: { inviteId } } });
    await this.jobs.enqueue({ tenantId, queue: 'notifications', name: 'team.invite.email', payload: { inviteId, token, email: invite.email } });
    return { ...updated, token };
  }

  async revokeInvite(tenantId: string, inviteId: string, actorUserId: string) {
    await this.findInvite(tenantId, inviteId);
    const updated = await this.prisma.tenantInvite.update({
      where: { id: inviteId },
      data: { status: InviteStatus.revoked, revokedAt: new Date() },
    });
    await this.prisma.auditLog.create({ data: { actorUserId, tenantId, event: 'team.invite.revoked', metadata: { inviteId } } });
    return updated;
  }

  async updateMember(tenantId: string, userId: string, body: Record<string, unknown>, actorUserId: string) {
    const member = await this.prisma.tenantUser.findUnique({ where: { tenantId_userId: { tenantId, userId } } });
    if (!member) throw new NotFoundException('Member not found');
    const role = this.role(body.role);
    const updated = await this.prisma.tenantUser.update({
      where: { tenantId_userId: { tenantId, userId } },
      data: { role },
    });
    await this.prisma.auditLog.create({ data: { actorUserId, tenantId, event: 'team.member.role_changed', metadata: { userId, role } } });
    return updated;
  }

  async removeMember(tenantId: string, userId: string, actorUserId: string) {
    await this.prisma.tenantUser.delete({ where: { tenantId_userId: { tenantId, userId } } });
    await this.prisma.auditLog.create({ data: { actorUserId, tenantId, event: 'team.member.removed', metadata: { userId } } });
    return { success: true };
  }

  async getInviteByToken(token: string) {
    const invite = await this.prisma.tenantInvite.findUnique({ where: { tokenHash: this.hash(token) } });
    if (!invite || invite.status !== InviteStatus.pending || invite.expiresAt < new Date()) throw new NotFoundException('Invite not found');
    return { email: invite.email, role: invite.role, tenantId: invite.tenantId, expiresAt: invite.expiresAt };
  }

  async acceptInvite(token: string, body: Record<string, unknown>) {
    const invite = await this.prisma.tenantInvite.findUnique({ where: { tokenHash: this.hash(token) } });
    if (!invite || invite.status !== InviteStatus.pending || invite.expiresAt < new Date()) throw new NotFoundException('Invite not found');
    await this.enforceSeatLimit(invite.tenantId);
    const userId = this.requiredString(body.userId, 'userId');
    await this.prisma.$transaction([
      this.prisma.tenantUser.upsert({
        where: { tenantId_userId: { tenantId: invite.tenantId, userId } },
        create: { tenantId: invite.tenantId, userId, role: invite.role },
        update: { role: invite.role },
      }),
      this.prisma.tenantInvite.update({
        where: { id: invite.id },
        data: { status: InviteStatus.accepted, acceptedAt: new Date() },
      }),
      this.prisma.auditLog.create({ data: { actorUserId: userId, tenantId: invite.tenantId, event: 'team.invite.accepted', metadata: { inviteId: invite.id } } }),
    ]);
    return { success: true };
  }

  private async enforceSeatLimit(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { seats: true } });
    const memberCount = await this.prisma.tenantUser.count({ where: { tenantId } });
    if (tenant && memberCount >= tenant.seats) throw new BadRequestException('Seat limit reached');
  }

  private async findInvite(tenantId: string, id: string) {
    const invite = await this.prisma.tenantInvite.findFirst({ where: { tenantId, id } });
    if (!invite) throw new NotFoundException('Invite not found');
    return invite;
  }

  private role(value: unknown) {
    if (typeof value !== 'string' || !Object.values(TenantMemberRole).includes(value as TenantMemberRole)) {
      throw new BadRequestException(`role must be one of: ${Object.values(TenantMemberRole).join(', ')}`);
    }
    return value as TenantMemberRole;
  }

  private requiredString(value: unknown, field: string) {
    if (typeof value !== 'string' || !value.trim()) throw new BadRequestException(`${field} is required`);
    return value.trim();
  }

  private hash(value: string) {
    return createHash('sha256').update(value).digest('hex');
  }
}

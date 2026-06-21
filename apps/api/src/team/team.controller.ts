import { Body, Controller, Delete, Get, Headers, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { TenantMemberRole } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { TenantRoles } from '../auth/decorators/tenant-roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantRolesGuard } from '../auth/guards/tenant-roles.guard';
import { AuthenticatedUser } from '../auth/types';
import { resolveTenantId } from '../common/tenant-context';
import { TeamService } from './team.service';

@Controller('team')
@UseGuards(JwtAuthGuard, TenantRolesGuard)
export class TeamController {
  constructor(private readonly team: TeamService) {}

  @Get('members')
  members(@CurrentUser() user: AuthenticatedUser, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.team.members(resolveTenantId(user, selectedTenantId));
  }

  @Get('invites')
  invites(@CurrentUser() user: AuthenticatedUser, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.team.invites(resolveTenantId(user, selectedTenantId));
  }

  @TenantRoles(TenantMemberRole.owner, TenantMemberRole.admin)
  @Post('invites')
  invite(@CurrentUser() user: AuthenticatedUser, @Body() body: Record<string, unknown>, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.team.createInvite(resolveTenantId(user, selectedTenantId), user.id, body);
  }

  @TenantRoles(TenantMemberRole.owner, TenantMemberRole.admin)
  @Post('invites/:id/resend')
  resend(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.team.resendInvite(resolveTenantId(user, selectedTenantId), id, user.id);
  }

  @TenantRoles(TenantMemberRole.owner, TenantMemberRole.admin)
  @Delete('invites/:id')
  revoke(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.team.revokeInvite(resolveTenantId(user, selectedTenantId), id, user.id);
  }

  @TenantRoles(TenantMemberRole.owner, TenantMemberRole.admin)
  @Patch('members/:userId')
  updateMember(@CurrentUser() user: AuthenticatedUser, @Param('userId') userId: string, @Body() body: Record<string, unknown>, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.team.updateMember(resolveTenantId(user, selectedTenantId), userId, body, user.id);
  }

  @TenantRoles(TenantMemberRole.owner)
  @Delete('members/:userId')
  removeMember(@CurrentUser() user: AuthenticatedUser, @Param('userId') userId: string, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.team.removeMember(resolveTenantId(user, selectedTenantId), userId, user.id);
  }
}

@Controller('team/invites')
export class TeamInvitePublicController {
  constructor(private readonly team: TeamService) {}

  @Get(':token')
  getInvite(@Param('token') token: string) {
    return this.team.getInviteByToken(token);
  }

  @Post(':token/accept')
  accept(@Param('token') token: string, @Body() body: Record<string, unknown>) {
    return this.team.acceptInvite(token, body);
  }
}

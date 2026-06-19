import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ProvidersModule } from '../providers/providers.module';
import { TeamController, TeamInvitePublicController } from './team.controller';
import { TeamService } from './team.service';

@Module({
  imports: [PrismaModule, ProvidersModule, AuthModule],
  controllers: [TeamController, TeamInvitePublicController],
  providers: [TeamService],
})
export class TeamModule {}

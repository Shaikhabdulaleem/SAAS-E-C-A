import { PrismaClient, UserRole } from '@prisma/client';
import { randomBytes, scrypt as scryptCallback } from 'crypto';
import { promisify } from 'util';

const prisma = new PrismaClient();
const scrypt = promisify(scryptCallback);

const seededTenantIds = ['t1', 't2', 't3', 't4', 't5'];
const seededClientEmailDomain = ['@client', 'nexushq.com'].join('.');

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt:${salt}:${derivedKey.toString('hex')}`;
}

async function upsertAdminUser(data: {
  id: string;
  email: string;
  password: string;
  name: string;
  initials: string;
}) {
  await prisma.user.upsert({
    where: { email: data.email },
    update: {
      name: data.name,
      role: UserRole.superadmin,
      initials: data.initials,
      tenantId: null,
      tenantName: null,
      passwordHash: await hashPassword(data.password),
    },
    create: {
      id: data.id,
      email: data.email,
      passwordHash: await hashPassword(data.password),
      name: data.name,
      role: UserRole.superadmin,
      initials: data.initials,
    },
  });
}

async function removeSeededClientData() {
  await prisma.user.deleteMany({
    where: {
      OR: [
        { id: { in: ['c1', 'c2', 'c3', 'c4'] } },
        { email: { endsWith: seededClientEmailDomain } },
      ],
    },
  });

  await prisma.tenant.deleteMany({
    where: { id: { in: seededTenantIds } },
  });
}

async function main() {
  await removeSeededClientData();

  await Promise.all([
    upsertAdminUser({
      id: 'sa1',
      email: 'admin@nexushq.com',
      password: 'admin123',
      name: 'Nexus Admin',
      initials: 'JD',
    }),
    upsertAdminUser({
      id: 'sa2',
      email: 'sales@nexushq.com',
      password: 'sales123',
      name: 'Nexus Sales',
      initials: 'JS',
    }),
  ]);

  await prisma.financeSetting.upsert({
    where: { id: 'finance-settings-mcc' },
    update: {
      scope: 'mcc',
      tenantId: null,
      invoicePrefix: 'MCC-INV',
      creditNotePrefix: 'MCC-CN',
      defaultPaymentTerms: 'Net 15',
      defaultCurrency: 'USD',
      acceptedPaymentMethods: ['bank_transfer', 'manual'],
      invoiceFooterText: 'Thank you for your business.',
      reminderDays: [3, 7, 14],
    },
    create: {
      id: 'finance-settings-mcc',
      scope: 'mcc',
      invoicePrefix: 'MCC-INV',
      creditNotePrefix: 'MCC-CN',
      defaultPaymentTerms: 'Net 15',
      defaultCurrency: 'USD',
      acceptedPaymentMethods: ['bank_transfer', 'manual'],
      invoiceFooterText: 'Thank you for your business.',
      reminderDays: [3, 7, 14],
    },
  });

  await prisma.financeTaxConfig.upsert({
    where: { id: 'finance-tax-mcc-default' },
    update: {
      scope: 'mcc',
      tenantId: null,
      name: 'No Tax',
      rate: 0,
      type: 'percentage',
      appliesTo: 'all',
      isDefault: true,
      isActive: true,
    },
    create: {
      id: 'finance-tax-mcc-default',
      scope: 'mcc',
      name: 'No Tax',
      rate: 0,
      type: 'percentage',
      appliesTo: 'all',
      isDefault: true,
      isActive: true,
    },
  });
}

main()
  .catch(async (error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create default admin user
  const hashedPassword = await bcrypt.hash('admin123!', 12);
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@sdlchub.dev' },
    update: {},
    create: {
      email: 'admin@sdlchub.dev',
      name: 'Admin User',
      password: hashedPassword,
    },
  });
  console.log(`  ✓ Admin user: ${adminUser.email}`);

  // Create default organization
  const org = await prisma.organization.upsert({
    where: { key: 'DEFAULT' },
    update: {},
    create: {
      name: 'Default Organization',
      key: 'DEFAULT',
      description: 'Default organization for SDLC Hub',
      memberships: {
        create: {
          userId: adminUser.id,
          role: 'ADMIN',
        },
      },
    },
  });
  console.log(`  ✓ Organization: ${org.name} (${org.key})`);

  // Create sample project
  const project = await prisma.project.upsert({
    where: { organizationId_key: { organizationId: org.id, key: 'DEMO' } },
    update: {},
    create: {
      name: 'Demo Project',
      key: 'DEMO',
      description: 'A sample project to explore SDLC Hub features',
      timezone: 'UTC',
      organizationId: org.id,
    },
  });
  console.log(`  ✓ Project: ${project.name} (${project.key})`);

  // Create default workflow phases
  const defaultPhases = [
    { name: 'Idea', order: 1, color: '#6B7280' },
    { name: 'Ready for Dev', order: 2, color: '#3B82F6' },
    { name: 'In Dev', order: 3, color: '#4F6EF7' },
    { name: 'In Review', order: 4, color: '#F59E0B' },
    { name: 'In Test', order: 5, color: '#8B5CF6' },
    { name: 'Ready for Release', order: 6, color: '#22C55E' },
    { name: 'In Production', order: 7, color: '#10B981' },
  ];

  for (const phase of defaultPhases) {
    await prisma.workflowPhase.upsert({
      where: { projectId_order: { projectId: project.id, order: phase.order } },
      update: {},
      create: {
        projectId: project.id,
        ...phase,
      },
    });
  }
  console.log(`  ✓ Workflow phases: ${defaultPhases.length} phases created`);

  console.log('\n✅ Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

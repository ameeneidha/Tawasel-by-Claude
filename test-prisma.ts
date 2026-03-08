import prisma from './src/lib/prisma.js';

async function test() {
  try {
    const users = await prisma.user.findMany();
    const userId = users.find(u => u.email === 'ameeneidha@gmail.com')?.id;
    console.log('User ID:', userId);
    const memberships = await prisma.workspaceMembership.findMany({
      where: { userId },
      include: { workspace: true }
    });
    console.log('Memberships found:', memberships.length);
    console.log('Workspaces:', memberships.map(m => m.workspace.name));
  } catch (e) {
    console.error('Prisma test failed:', e);
  } finally {
    await prisma.$disconnect();
  }
}

test();

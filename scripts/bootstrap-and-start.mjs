import { spawnSync, spawn } from 'node:child_process';
import process from 'node:process';

const runStep = (command, args, label) => {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: process.env,
  });

  if (result.status !== 0) {
    throw new Error(`${label} failed with exit code ${result.status ?? 'unknown'}`);
  }
};

const maybeSeedDemoData = async () => {
  if (String(process.env.AUTO_SEED_DEMO || '').toLowerCase() !== 'true') {
    return;
  }

  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();

  try {
    const userCount = await prisma.user.count();
    if (userCount === 0) {
      console.log('[bootstrap] Database is empty. Seeding demo data...');
      runStep('npm', ['run', 'seed'], 'demo seed');
    } else {
      console.log('[bootstrap] Skipping demo seed because users already exist.');
    }
  } finally {
    await prisma.$disconnect();
  }
};

const start = async () => {
  console.log('[bootstrap] Ensuring Prisma schema is applied...');
  runStep('npx', ['prisma', 'db', 'push'], 'prisma db push');

  await maybeSeedDemoData();

  console.log('[bootstrap] Starting application server...');
  const child = spawn('npx', ['tsx', 'server.ts'], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: process.env,
  });

  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 0);
  });
};

start().catch((error) => {
  console.error('[bootstrap] Failed to start application:', error);
  process.exit(1);
});

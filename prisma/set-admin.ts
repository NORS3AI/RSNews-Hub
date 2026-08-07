// Create-or-reset an admin login. Unlike the seed (which leaves an existing
// admin untouched), this always sets the password + guarantees ADMIN/ACTIVE, so
// it fixes a "login doesn't work" account. Runs against whatever DATABASE_URL is
// configured.
//
// Usage:
//   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='choose-a-strong-one' npm run admin:set
//
// Defaults email to admin@rsnews.local if unset. ADMIN_PASSWORD is required.

import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const email = (process.env.ADMIN_EMAIL || 'admin@rsnews.local').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || '';
  if (password.length < 6) {
    console.error('Set ADMIN_PASSWORD (at least 6 characters). Nothing changed.');
    process.exit(1);
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash, role: 'ADMIN', status: 'ACTIVE' },
    create: { email, name: 'Site Admin', passwordHash, role: 'ADMIN', status: 'ACTIVE', bio: 'The RSNews Hub administrator.' },
  });
  console.log(`Admin ready: ${user.email} (role ${user.role}, status ${user.status}). Log in with the password you just set.`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());

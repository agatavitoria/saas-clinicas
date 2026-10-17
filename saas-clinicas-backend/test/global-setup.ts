import { execSync } from 'node:child_process';
import { TEST_DATABASE_URL } from './test-database.js';

/**
 * Aplica as migrations pendentes no banco de teste antes da suíte.
 * Cada arquivo de teste limpa os próprios dados.
 */
export default function setup(): void {
  execSync('npx prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    stdio: 'inherit',
  });
}

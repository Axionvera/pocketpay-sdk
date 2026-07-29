/**
 * Prints a human-readable coverage baseline summary from Vitest's
 * coverage/coverage-summary.json (issue #367).
 *
 * Run via: npm run coverage:baseline
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');
const SUMMARY_PATH = path.join(ROOT, 'coverage', 'coverage-summary.json');

interface Totals {
  total: number;
  covered: number;
  skipped: number;
  pct: number;
}

interface FileSummary {
  lines: Totals;
  statements: Totals;
  functions: Totals;
  branches: Totals;
  path?: string;
}

type CoverageSummary = Record<string, FileSummary>;

function pct(n: number): string {
  return `${n.toFixed(2)}%`;
}

function moduleOf(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/');
  const marker = '/src/';
  const idx = normalized.lastIndexOf(marker);
  if (idx === -1) return '(other)';
  const rest = normalized.slice(idx + marker.length);
  const first = rest.split('/')[0] ?? '(other)';
  if (first.endsWith('.ts')) return 'src (root)';
  return first;
}

function main(): number {
  if (!fs.existsSync(SUMMARY_PATH)) {
    console.error('Missing coverage/coverage-summary.json');
    console.error('Run `npm run test:coverage` first (or use `npm run coverage:baseline`).');
    console.error('See docs/coverage-baseline.md');
    return 1;
  }

  const summary = JSON.parse(fs.readFileSync(SUMMARY_PATH, 'utf-8')) as CoverageSummary;
  const total = summary.total;
  if (!total) {
    console.error('coverage-summary.json has no "total" entry');
    return 1;
  }

  console.log('PocketPay SDK — Coverage baseline report');
  console.log('========================================');
  console.log('');
  console.log('Overall (src/)');
  console.log(`  Statements : ${pct(total.statements.pct)}  (${total.statements.covered}/${total.statements.total})`);
  console.log(`  Branches   : ${pct(total.branches.pct)}  (${total.branches.covered}/${total.branches.total})`);
  console.log(`  Functions  : ${pct(total.functions.pct)}  (${total.functions.covered}/${total.functions.total})`);
  console.log(`  Lines      : ${pct(total.lines.pct)}  (${total.lines.covered}/${total.lines.total})`);
  console.log('');

  const byModule = new Map<string, { statements: number; lines: number; files: number }>();

  for (const [filePath, file] of Object.entries(summary)) {
    if (filePath === 'total') continue;
    const mod = moduleOf(filePath);
    const entry = byModule.get(mod) ?? { statements: 0, lines: 0, files: 0 };
    entry.statements += file.statements.pct;
    entry.lines += file.lines.pct;
    entry.files += 1;
    byModule.set(mod, entry);
  }

  console.log('By module (average file % under src/<module>/)');
  console.log('  Module          Files   Stmts%    Lines%');
  console.log('  -------------   -----   -------   -------');

  const modules = [...byModule.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  for (const [mod, stats] of modules) {
    const stmts = stats.statements / stats.files;
    const lines = stats.lines / stats.files;
    console.log(
      `  ${mod.padEnd(14)}  ${String(stats.files).padStart(5)}   ${pct(stmts).padStart(7)}   ${pct(lines).padStart(7)}`,
    );
  }

  console.log('');
  console.log('Artifacts');
  console.log('  Text summary : printed above / Vitest text reporter');
  console.log('  HTML report  : coverage/index.html');
  console.log('  JSON summary : coverage/coverage-summary.json');
  console.log('  LCOV         : coverage/lcov.info (CI upload)');
  console.log('');
  console.log('Changed-module expectations: docs/coverage-baseline.md');
  console.log('Thresholds are informational (0) today — do not treat this as a hard CI gate yet.');
  return 0;
}

process.exit(main());

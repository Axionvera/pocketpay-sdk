#!/usr/bin/env node
/**
 * Pre-PR acceptance criteria verification script (issue #369).
 *
 * Runs automated SDK checks, surfaces CI/docs/test reminders from git diff,
 * and prints a structured acceptance-criteria checklist for contributors.
 */
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import {
  extractAcceptanceCriteriaItems,
  formatChecklistReport,
  generateChecklistMarkdown,
  parseChecklistFile,
} from './lib/acceptance-checklist';

const ROOT = path.resolve(__dirname, '..');
const CHECKLIST_DIR = path.join(ROOT, '.github', 'checklists');
const TEMPLATE_PATH = path.join(CHECKLIST_DIR, 'acceptance-criteria.template.md');

interface CliOptions {
  checklist?: string;
  issue?: number;
  generate: boolean;
  out?: string;
  title?: string;
  criteria: string[];
  skipChecks: boolean;
  help: boolean;
}

interface AutomatedCheck {
  id: string;
  label: string;
  command: string;
  args: string[];
  ciLabel: string;
}

const AUTOMATED_CHECKS: AutomatedCheck[] = [
  {
    id: 'lint',
    label: 'TypeScript type check',
    command: 'npm',
    args: ['run', 'lint'],
    ciLabel: 'lint (tsc --noEmit)',
  },
  {
    id: 'circular',
    label: 'Circular dependency check',
    command: 'npm',
    args: ['run', 'check:circular'],
    ciLabel: 'check:circular',
  },
  {
    id: 'test',
    label: 'Unit tests (offline)',
    command: 'npm',
    args: ['test'],
    ciLabel: 'vitest unit suite',
  },
  {
    id: 'coverage',
    label: 'Test coverage report',
    command: 'npm',
    args: ['run', 'test:coverage'],
    ciLabel: 'vitest coverage (v8)',
  },
  {
    id: 'build',
    label: 'Package build',
    command: 'npm',
    args: ['run', 'build'],
    ciLabel: 'tsc build',
  },
];

const STANDARD_REMINDERS = [
  'Map each GitHub issue acceptance criterion to a concrete change in the PR description.',
  'Add or update unit tests for every behaviour change (see docs/testing.md).',
  'Update docs/ or README.md when public behaviour, errors, or workflows change.',
  'Push your branch and confirm GitHub Actions / CI checks pass on the pull request.',
  'Reference the issue in the PR body (e.g. Closes #369).',
  'Confirm no .env values, secret keys, or credentials are committed.',
];

function printHelp(): void {
  console.log(`
PocketPay SDK — Pre-PR Acceptance Verification

Usage:
  npm run verify:pr [-- options]

Options:
  --checklist <path>     Markdown checklist with acceptance criteria items
  --issue <number>       Load .github/checklists/issue-<number>.md
  --generate             Write a checklist template (use with --issue, --title)
  --out <path>           Output file for --generate (stdout when omitted)
  --title <text>         Issue title for generated checklist
  --criteria <items>     Semicolon-separated acceptance criteria for --generate
  --skip-checks          Print reminders only; do not run automated checks
  --help                 Show this help message

Examples:
  npm run verify:pr
  npm run verify:pr -- --issue 369
  npm run verify:pr -- --checklist .github/checklists/issue-369.md
  npm run verify:pr -- --generate --issue 369 --title "My feature" \\
    --criteria "Tests added;Docs updated" --out .github/checklists/issue-369.md

Documentation: docs/pre-pr-verification.md
`);
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    generate: false,
    criteria: [],
    skipChecks: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg) continue;

    switch (arg) {
      case '--help':
      case '-h':
        options.help = true;
        break;
      case '--generate':
        options.generate = true;
        break;
      case '--skip-checks':
        options.skipChecks = true;
        break;
      case '--checklist':
        options.checklist = argv[++i];
        break;
      case '--issue': {
        const value = argv[++i];
        options.issue = value ? Number(value) : undefined;
        break;
      }
      case '--out':
        options.out = argv[++i];
        break;
      case '--title':
        options.title = argv[++i];
        break;
      case '--criteria': {
        const value = argv[++i];
        if (value) {
          options.criteria = value
            .split(';')
            .map((item) => item.trim())
            .filter(Boolean);
        }
        break;
      }
      default:
        console.error(`Unknown option: ${arg}`);
        options.help = true;
    }
  }

  return options;
}

function runCommand(check: AutomatedCheck): { ok: boolean; durationMs: number } {
  const started = Date.now();
  const result = spawnSync(check.command, check.args, {
    cwd: ROOT,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  return { ok: result.status === 0, durationMs: Date.now() - started };
}

function gitLines(args: string[]): string[] {
  const result = spawnSync('git', args, {
    cwd: ROOT,
    encoding: 'utf-8',
  });
  if (result.status !== 0 || !result.stdout) return [];
  return result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function collectChangedFiles(): string[] {
  const tracked = new Set<string>([
    ...gitLines(['diff', '--name-only', 'HEAD']),
    ...gitLines(['diff', '--name-only', '--cached']),
    ...gitLines(['ls-files', '--others', '--exclude-standard']),
  ]);

  const againstMain = gitLines(['diff', '--name-only', 'origin/main...HEAD']);
  for (const file of againstMain) tracked.add(file);

  return [...tracked];
}

function buildDiffReminders(changedFiles: string[]): string[] {
  if (changedFiles.length === 0) return [];

  const reminders: string[] = [];
  const srcChanged = changedFiles.some((file) => file.startsWith('src/'));
  const testsChanged = changedFiles.some((file) => file.startsWith('tests/'));
  const docsChanged = changedFiles.some(
    (file) => file.startsWith('docs/') || file === 'README.md' || file === 'CONTRIBUTING.md',
  );
  const workflowChanged = changedFiles.some((file) => file.startsWith('.github/workflows/'));
  const integrationTouched = changedFiles.some(
    (file) =>
      file.includes('integration.test') ||
      file.startsWith('src/soroban/') ||
      file.startsWith('src/network/'),
  );

  if (srcChanged && !testsChanged) {
    reminders.push('Source files changed but no tests/ updates detected — add regression coverage.');
  }
  if (srcChanged && !docsChanged) {
    reminders.push('Source files changed without docs/ or README updates — update docs if behaviour is public.');
  }
  if (workflowChanged) {
    reminders.push('GitHub workflow files changed — push the branch and confirm CI passes on the PR.');
  }
  if (integrationTouched) {
    reminders.push(
      'Network or integration-sensitive code changed — consider RUN_INTEGRATION=1 npm run test:integration.',
    );
  }

  return reminders;
}

function resolveChecklistPath(options: CliOptions): string | undefined {
  if (options.checklist) return path.resolve(options.checklist);
  if (options.issue) return path.join(CHECKLIST_DIR, `issue-${options.issue}.md`);
  return undefined;
}

function handleGenerate(options: CliOptions): number {
  if (!options.issue) {
    console.error('error: --generate requires --issue <number>');
    return 1;
  }

  const title = options.title ?? `Issue #${options.issue}`;
  const markdown = generateChecklistMarkdown({
    issueNumber: options.issue,
    title,
    criteria: options.criteria,
  });

  if (options.out) {
    const outPath = path.resolve(options.out);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, markdown, 'utf-8');
    console.log(`Wrote checklist template to ${path.relative(ROOT, outPath)}`);
    return 0;
  }

  process.stdout.write(markdown);
  return 0;
}

function printSection(title: string): void {
  console.log(`\n${title}`);
  console.log('─'.repeat(title.length));
}

function main(): number {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return 0;
  }

  if (options.generate) {
    return handleGenerate(options);
  }

  console.log('PocketPay SDK — Pre-PR Acceptance Verification');
  console.log('============================================');

  const failedChecks: string[] = [];

  if (!options.skipChecks) {
    printSection('1. Automated checks (local CI parity)');
    for (const check of AUTOMATED_CHECKS) {
      process.stdout.write(`\n→ ${check.label} [${check.ciLabel}]\n`);
      const result = runCommand(check);
      const icon = result.ok ? '✓' : '✗';
      console.log(`${icon} ${check.label} (${result.durationMs}ms)`);
      if (!result.ok) failedChecks.push(check.id);
    }
  } else {
    printSection('1. Automated checks (skipped via --skip-checks)');
    console.log('  Run without --skip-checks to execute lint, tests, and build.');
  }

  printSection('2. Git change reminders');
  const changedFiles = collectChangedFiles();
  if (changedFiles.length === 0) {
    console.log('  No local git changes detected.');
  } else {
    console.log(`  Changed files (${changedFiles.length}):`);
    for (const file of changedFiles.slice(0, 12)) {
      console.log(`    • ${file}`);
    }
    if (changedFiles.length > 12) {
      console.log(`    • …and ${changedFiles.length - 12} more`);
    }
  }

  const diffReminders = buildDiffReminders(changedFiles);
  if (diffReminders.length > 0) {
    console.log('\n  Suggested follow-ups:');
    for (const reminder of diffReminders) {
      console.log(`    • ${reminder}`);
    }
  } else {
    console.log('  No extra git-based reminders.');
  }

  printSection('3. Standard pre-PR reminders');
  for (const reminder of STANDARD_REMINDERS) {
    console.log(`  • ${reminder}`);
  }

  printSection('4. Acceptance criteria checklist');
  const checklistPath = resolveChecklistPath(options);
  if (checklistPath && fs.existsSync(checklistPath)) {
    const parsed = parseChecklistFile(checklistPath);
    const label = parsed.issueNumber
      ? `issue #${parsed.issueNumber}`
      : path.relative(ROOT, checklistPath);
    console.log(`  Checklist: ${label}`);
    if (parsed.title) console.log(`  Title: ${parsed.title}`);
    console.log('');
    console.log(formatChecklistReport(parsed.items));

    const unchecked = parsed.items.filter((item) => !item.checked).length;
    if (parsed.items.length > 0) {
      console.log(
        `\n  Confirm each unchecked item before opening the PR (${unchecked} remaining).`,
      );
    }
  } else if (options.issue) {
    console.log(`  No checklist found at .github/checklists/issue-${options.issue}.md`);
    console.log('  Generate one with:');
    console.log(
      `    npm run verify:pr -- --generate --issue ${options.issue} --title "Your issue title" --out .github/checklists/issue-${options.issue}.md`,
    );
    if (fs.existsSync(TEMPLATE_PATH)) {
      const templateItems = extractAcceptanceCriteriaItems(
        fs.readFileSync(TEMPLATE_PATH, 'utf-8'),
      );
      console.log('\n  Template reminders:');
      console.log(formatChecklistReport(templateItems));
    }
  } else {
    console.log('  No issue checklist supplied. Options:');
    console.log('    npm run verify:pr -- --issue <number>');
    console.log('    npm run verify:pr -- --checklist path/to/checklist.md');
    if (fs.existsSync(TEMPLATE_PATH)) {
      const templateItems = extractAcceptanceCriteriaItems(
        fs.readFileSync(TEMPLATE_PATH, 'utf-8'),
      );
      console.log('\n  Generic template:');
      console.log(formatChecklistReport(templateItems));
    }
  }

  printSection('5. Next steps');
  if (failedChecks.length > 0) {
    console.log('  ✗ Fix failing automated checks, then re-run npm run verify:pr');
    return 1;
  }

  console.log('  ✓ Automated checks passed (or were skipped intentionally).');
  console.log('  • Confirm each acceptance criterion is met.');
  console.log('  • Open your PR and paste the checklist into the description.');
  console.log('  • Watch CI on GitHub before requesting review.');
  return 0;
}

const exitCode = main();
process.exit(exitCode);

import fs from 'fs';
import path from 'path';

export interface ChecklistItem {
  line: number;
  checked: boolean;
  text: string;
}

export interface ParsedChecklist {
  title?: string;
  issueNumber?: number;
  items: ChecklistItem[];
  rawSections: string[];
}

const CHECKBOX_RE = /^(\s*)- \[([ xX])\]\s+(.+)$/;

/**
 * Parses markdown checklist items (`- [ ]` / `- [x]`) from a file or string.
 */
export function parseChecklistMarkdown(content: string): ChecklistItem[] {
  const items: ChecklistItem[] = [];
  const lines = content.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    const match = line.match(CHECKBOX_RE);
    if (!match) continue;

    items.push({
      line: i + 1,
      checked: match[2]?.toLowerCase() === 'x',
      text: match[3]?.trim() ?? '',
    });
  }

  return items;
}

/**
 * Prefer items under an "## Acceptance Criteria" heading when present.
 */
export function extractAcceptanceCriteriaItems(content: string): ChecklistItem[] {
  const lines = content.split(/\r?\n/);
  const startIdx = lines.findIndex((line) =>
    /^##\s+acceptance criteria\b/i.test(line.trim()),
  );

  if (startIdx === -1) {
    return parseChecklistMarkdown(content);
  }

  const sectionLines: string[] = [];
  for (let i = startIdx + 1; i < lines.length; i++) {
    const line = lines[i] ?? '';
    if (/^##\s+/.test(line.trim())) break;
    sectionLines.push(line);
  }

  return parseChecklistMarkdown(sectionLines.join('\n'));
}

export function parseChecklistFile(filePath: string): ParsedChecklist {
  const absolute = path.resolve(filePath);
  const content = fs.readFileSync(absolute, 'utf-8');
  const issueMatch = content.match(/\*\*Number:\*\*\s*#(\d+)/i);
  const titleMatch = content.match(/\*\*Title:\*\*\s*(.+)/i);

  return {
    title: titleMatch?.[1]?.trim(),
    issueNumber: issueMatch ? Number(issueMatch[1]) : undefined,
    items: extractAcceptanceCriteriaItems(content),
    rawSections: content
      .split(/^##\s+/m)
      .map((section) => section.trim())
      .filter(Boolean),
  };
}

export interface GenerateChecklistOptions {
  issueNumber: number;
  title: string;
  criteria: string[];
  verificationCommand?: string;
}

/**
 * Builds a contributor-facing acceptance criteria checklist markdown file.
 */
export function generateChecklistMarkdown(options: GenerateChecklistOptions): string {
  const command = options.verificationCommand ?? 'npm run verify:pr';
  const criteriaLines =
    options.criteria.length > 0
      ? options.criteria.map((item) => `- [ ] ${item.trim()}`).join('\n')
      : '- [ ] <!-- Paste each acceptance criterion from the GitHub issue -->';

  return `# Acceptance Criteria Checklist — Issue #${options.issueNumber}

> Generated for pre-PR verification. Confirm each item, then run:
>
> \`\`\`bash
> ${command} -- --checklist .github/checklists/issue-${options.issueNumber}.md
> \`\`\`

## Issue

- **Number:** #${options.issueNumber}
- **Title:** ${options.title}

## Acceptance Criteria

${criteriaLines}

## Contributor confirmations

- [ ] Automated checks passed (\`npm run verify:pr\`)
- [ ] Tests added or updated for behaviour changes
- [ ] Documentation updated when public behaviour changed
- [ ] PR description maps each acceptance criterion to the change
- [ ] No secrets or \`.env\` values committed
`;
}

export function formatChecklistReport(items: ChecklistItem[]): string {
  if (items.length === 0) {
    return '  (no checklist items found — add `- [ ]` lines under ## Acceptance Criteria)';
  }

  return items
    .map((item) => {
      const status = item.checked ? '[x]' : '[ ]';
      return `  ${status} ${item.text}`;
    })
    .join('\n');
}

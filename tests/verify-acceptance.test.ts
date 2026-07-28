import { describe, it, expect } from 'vitest';
import {
  extractAcceptanceCriteriaItems,
  formatChecklistReport,
  generateChecklistMarkdown,
  parseChecklistMarkdown,
} from '../scripts/lib/acceptance-checklist';

describe('acceptance checklist helpers', () => {
  it('parses unchecked and checked markdown items', () => {
    const items = parseChecklistMarkdown(`
- [ ] First criterion
- [x] Already done
- [ ] Third criterion
`);

    expect(items).toHaveLength(3);
    expect(items[0]).toMatchObject({ checked: false, text: 'First criterion' });
    expect(items[1]).toMatchObject({ checked: true, text: 'Already done' });
  });

  it('extracts only items under an Acceptance Criteria heading', () => {
    const items = extractAcceptanceCriteriaItems(`
## Summary
- [ ] ignored item

## Acceptance Criteria
- [ ] Required test coverage
- [ ] Docs updated

## Test plan
- [ ] manual step
`);

    expect(items).toHaveLength(2);
    expect(items[0]?.text).toBe('Required test coverage');
    expect(items[1]?.text).toBe('Docs updated');
  });

  it('formats a checklist report for terminal output', () => {
    const report = formatChecklistReport([
      { line: 1, checked: false, text: 'Add tests' },
      { line: 2, checked: true, text: 'Update docs' },
    ]);

    expect(report).toContain('[ ] Add tests');
    expect(report).toContain('[x] Update docs');
  });

  it('generates a contributor checklist markdown file', () => {
    const markdown = generateChecklistMarkdown({
      issueNumber: 369,
      title: 'Add verification script',
      criteria: ['Script added', 'Docs updated'],
    });

    expect(markdown).toContain('# Acceptance Criteria Checklist — Issue #369');
    expect(markdown).toContain('- [ ] Script added');
    expect(markdown).toContain('- [ ] Docs updated');
    expect(markdown).toContain('npm run verify:pr');
  });
});

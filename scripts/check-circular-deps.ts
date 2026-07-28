import fs from 'fs';
import path from 'path';

const SRC_DIR = path.resolve(process.cwd(), 'src');

/**
 * Recursively scans directory for TypeScript files (excluding .d.ts).
 */
function getTsFiles(dir: string): string[] {
  const files: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...getTsFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
      files.push(fullPath);
    }
  }
  return files;
}

/**
 * Resolves a relative import specifier to a relative path within src/.
 */
function resolveImportPath(importingFile: string, importSpecifier: string): string | null {
  if (!importSpecifier.startsWith('.')) return null;

  const dir = path.dirname(importingFile);
  const resolved = path.resolve(dir, importSpecifier);

  const candidates = [
    resolved,
    `${resolved}.ts`,
    `${resolved}.tsx`,
    path.join(resolved, 'index.ts'),
    path.join(resolved, 'index.tsx'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return path.relative(SRC_DIR, candidate).replace(/\\/g, '/');
    }
  }

  return null;
}

/**
 * Extracts all import/export relative module specifiers from file content.
 */
function extractImports(filePath: string): string[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const importSpecifiers: string[] = [];

  // Match import ... from '...' or export ... from '...'
  const fromRegex = /(?:import|export)\s+[\s\S]*?\s+from\s+['"]([^'"]+)['"]/g;
  let match;
  while ((match = fromRegex.exec(content)) !== null) {
    importSpecifiers.push(match[1]);
  }

  // Match dynamic imports: import('...')
  const dynamicImportRegex = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((match = dynamicImportRegex.exec(content)) !== null) {
    importSpecifiers.push(match[1]);
  }

  return importSpecifiers;
}

/**
 * Main circular dependency check using DFS.
 */
function checkCircularDependencies() {
  const files = getTsFiles(SRC_DIR);
  const graph = new Map<string, Set<string>>();

  for (const file of files) {
    const relPath = path.relative(SRC_DIR, file).replace(/\\/g, '/');
    const imports = extractImports(file);
    const deps = new Set<string>();

    for (const specifier of imports) {
      const resolved = resolveImportPath(file, specifier);
      if (resolved && resolved !== relPath) {
        deps.add(resolved);
      }
    }

    graph.set(relPath, deps);
  }

  const cycles: string[][] = [];
  const visited = new Set<string>();
  const inStack = new Set<string>();
  const stack: string[] = [];

  function dfs(node: string) {
    visited.add(node);
    inStack.add(node);
    stack.push(node);

    const neighbors = graph.get(node) || new Set();
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        dfs(neighbor);
      } else if (inStack.has(neighbor)) {
        const cycleStartIndex = stack.indexOf(neighbor);
        if (cycleStartIndex !== -1) {
          const cycle = stack.slice(cycleStartIndex).concat(neighbor);
          cycles.push(cycle);
        }
      }
    }

    stack.pop();
    inStack.delete(node);
  }

  for (const node of graph.keys()) {
    if (!visited.has(node)) {
      dfs(node);
    }
  }

  if (cycles.length > 0) {
    console.error(`\n❌ Found ${cycles.length} circular dependency cycle(s):`);
    for (const cycle of cycles) {
      console.error(`   ${cycle.join(' -> ')}`);
    }
    process.exit(1);
  } else {
    console.log(`\n✓ Circular dependency check passed cleanly across ${graph.size} modules in src/.\n`);
    process.exit(0);
  }
}

checkCircularDependencies();

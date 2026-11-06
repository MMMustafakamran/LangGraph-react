#!/usr/bin/env node
/**
 * Writes frontend/VERSIONS.md (declared vs installed) for the LangGraph JS harness.
 * The quickstart clip opens it in the IDE so every recording pins the versions it ran on.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const OUT = path.join(ROOT, 'frontend', 'VERSIONS.md');

const ROWS = [
  ['frontend', '@copilotkit/react-core'], ['frontend', '@copilotkit/runtime'], ['frontend', 'next'],
  ['frontend', 'react'], ['frontend', 'maplibre-gl'],
  ['agent', '@copilotkit/sdk-js'], ['agent', '@langchain/langgraph'], ['agent', '@langchain/core'],
  ['agent', '@langchain/openai'], ['agent', '@ag-ui/langgraph'], ['agent', 'zod'],
];

const readJson = (p) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; } };

let md = `# Installed versions (LangGraph JS harness)\n\nGenerated ${new Date().toISOString().slice(0, 10)}. Node ${process.version}, @langchain/langgraph-cli via npx.\n\n| Where | Package | Declared | Installed |\n|---|---|---|---|\n`;
for (const [dir, pkg] of ROWS) {
  const manifest = readJson(path.join(ROOT, dir, 'package.json')) ?? {};
  const declared = manifest.dependencies?.[pkg] ?? manifest.devDependencies?.[pkg] ?? '(transitive)';
  const installed = readJson(path.join(ROOT, dir, 'node_modules', pkg, 'package.json'))?.version ?? '-';
  md += `| ${dir} | ${pkg} | ${declared} | ${installed} |\n`;
}
fs.writeFileSync(OUT, md);
console.log(`wrote ${path.relative(ROOT, OUT)}`);

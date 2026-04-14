#!/usr/bin/env node
// PostToolUse hook: runs prettier on the specific file that was just edited.
// Attached in .claude/settings.json for Edit, Write, MultiEdit events.

const { execSync } = require('child_process');

let data = '';
process.stdin.on('data', chunk => (data += chunk));
process.stdin.on('end', () => {
  try {
    const input = JSON.parse(data);
    const filePath = input.file_path || input.path || '';
    if (!filePath || !/\.(ts|tsx|js|jsx|json|css|md)$/.test(filePath)) {
      process.exit(0);
    }
    execSync(
      `pnpm prettier --write ${JSON.stringify(filePath)} --log-level silent`,
      { stdio: 'pipe' },
    );
  } catch (_) {
    // Never block the tool call due to a formatting failure
  }
  process.exit(0);
});

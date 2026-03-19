#!/usr/bin/env node
// Simple build script that invokes Vite directly
const { spawnSync } = require('child_process');
const path = require('path');

const vitePath = path.join(__dirname, 'node_modules', 'vite', 'bin', 'vite.js');

console.log('Running Vite build...');
const result = spawnSync('node', [vitePath, 'build'], {
  stdio: 'inherit',
  env: { ...process.env }
});

process.exit(result.status);

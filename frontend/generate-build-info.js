// Simple script to generate build info files for local development
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory name in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure public directory exists
const publicDir = path.join(__dirname, 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Create build-info.json
const buildInfo = {
  build_date: new Date().toISOString(),
  version: '1.0.0-dev',
  environment: 'development'
};

fs.writeFileSync(
  path.join(publicDir, 'build-info.json'),
  JSON.stringify(buildInfo, null, 2)
);

console.log('✅ Generated build-info.json in public directory');

// Create build-info.js
const buildInfoJs = `window.BUILD_INFO = {
  buildDate: '${buildInfo.build_date}',
  version: '${buildInfo.version}',
  environment: '${buildInfo.environment}'
};`;

fs.writeFileSync(
  path.join(__dirname, 'src', 'build-info.js'),
  buildInfoJs
);

console.log('✅ Generated build-info.js in src directory');
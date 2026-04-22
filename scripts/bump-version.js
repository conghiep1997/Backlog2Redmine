const fs = require('fs');
const path = require('path');

const manifestPath = path.join(__dirname, '..', 'manifest.json');
const packageJsonPath = path.join(__dirname, '..', 'package.json');
const changelogPath = path.join(__dirname, '..', 'CHANGELOG.md');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf-8');
}

function formatDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function ensureChangelogStub(version) {
  const changelog = fs.readFileSync(changelogPath, 'utf-8');
  const heading = `## [${version}]`;

  if (changelog.includes(heading)) {
    console.log(`OK: CHANGELOG already contains entry for ${version}`);
    return;
  }

  const lines = changelog.split(/\r?\n/);
  const date = formatDate();
  const stub = [
    `${heading} - ${date}`,
    '- **✨ Added**:',
    '- **🔧 Fixed**:',
    '- **📝 Docs**:',
    '',
  ];

  if (lines.length > 0 && lines[0].startsWith('# ')) {
    const updated = [lines[0], '', ...stub, ...lines.slice(1)].join('\n');
    fs.writeFileSync(changelogPath, updated, 'utf-8');
  } else {
    const updated = ['# Nhật ký thay đổi (Changelog)', '', ...stub, ...lines].join('\n');
    fs.writeFileSync(changelogPath, updated, 'utf-8');
  }

  console.log(`OK: Added CHANGELOG stub entry for version ${version}`);
}

function isSemver(version) {
  return /^\d+\.\d+\.\d+$/.test(version);
}

function incrementPatch(version) {
  const [major, minor, patch] = version.split('.').map(Number);
  return `${major}.${minor}.${patch + 1}`;
}

function main() {
  const requestedVersion = process.argv[2];

  const manifest = readJson(manifestPath);
  const packageJson = readJson(packageJsonPath);
  const currentVersion = manifest.version;
  const version = requestedVersion || incrementPatch(currentVersion);

  if (!isSemver(version)) {
    console.error('Usage: node scripts/bump-version.js [x.y.z]');
    process.exit(1);
  }

  if (!isSemver(currentVersion)) {
    console.error(`ERROR: Current manifest.json version is invalid: ${currentVersion}`);
    process.exit(1);
  }

  manifest.version = version;
  packageJson.version = version;

  writeJson(manifestPath, manifest);
  writeJson(packageJsonPath, packageJson);
  ensureChangelogStub(version);

  console.log(`OK: Updated manifest.json and package.json from ${currentVersion} to ${version}`);
  console.log('Reminder: complete the generated CHANGELOG entry before shipping.');
}

main();

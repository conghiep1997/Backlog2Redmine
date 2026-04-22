const fs = require('fs');
const path = require('path');

const packageJsonPath = path.join(__dirname, '..', 'package.json');
const manifestPath = path.join(__dirname, '..', 'manifest.json');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function main() {
  const packageJson = readJson(packageJsonPath);
  const manifest = readJson(manifestPath);

  const packageVersion = packageJson.version;
  const manifestVersion = manifest.version;

  if (!packageVersion || !manifestVersion) {
    console.error('ERROR: Missing version in package.json or manifest.json');
    process.exit(1);
  }

  if (packageVersion !== manifestVersion) {
    console.error('ERROR: Version mismatch detected.');
    console.error(`package.json version : ${packageVersion}`);
    console.error(`manifest.json version: ${manifestVersion}`);
    console.error('manifest.json is the release source of truth. Sync the files before running release/build CI.');
    process.exit(1);
  }

  console.log(`OK: package.json and manifest.json are synchronized at version ${manifestVersion}`);
}

main();

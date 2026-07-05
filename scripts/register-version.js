const fs = require('fs');
const path = require('path');

/**
 * Registers the newly created GitHub Release version in the backend database.
 * Called by GitHub Actions workflow after a release is created/updated.
 */
async function registerVersion() {
  const {
    BACKEND_URL: backendUrl,
    VERSION: version,
    DOWNLOAD_URL: downloadUrl
  } = process.env;

  // Validate required environment variables
  if (!backendUrl) {
    console.error('❌ Missing BACKEND_URL environment variable.');
    process.exit(1);
  }

  if (!version) {
    console.error('❌ Missing VERSION environment variable.');
    process.exit(1);
  }

  if (!downloadUrl) {
    console.error('❌ Missing DOWNLOAD_URL environment variable.');
    process.exit(1);
  }

  // Parse changelog from CHANGELOG.md into structured format
  let changelog = [];
  let changelogContent = '';
  if (fs.existsSync('CHANGELOG.md')) {
    changelogContent = fs.readFileSync('CHANGELOG.md', 'utf8');
    changelog = parseChangelogToStructured(changelogContent, version);
  }

  // Extract description from changelog - first non-sub item as summary
  const description = extractReleaseDescription(changelogContent, version) || extractDescription(changelog);

  const payload = {
    name: `Backlog2Redmine v${version}`,
    version_number: version,
    description: description,
    is_latest: true,
    download_url: downloadUrl,
    changelog: changelog,
    release_date: new Date().toISOString()
  };

  console.log('📝 Registering version in backend...');
  console.log(`   Version: ${version}`);
  console.log(`   Description: ${description}`);
  console.log(`   Download URL: ${downloadUrl}`);
  console.log(`   Changes: ${changelog.length} items`);

  try {
    const response = await fetch(`${backendUrl}/api/versions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      const result = await response.json();
      console.log(`✅ Version ${version} registered successfully!`);
      console.log(`   Backend ID: ${result.id}`);
    } else {
      const errorText = await response.text();
      console.error(`❌ Backend API error (${response.status}):`, errorText);
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Failed to register version:', error.message);
    process.exit(1);
  }
}

/**
 * Parse CHANGELOG.md into structured changelog items
 * @param {string} content - CHANGELOG.md content
 * @param {string} version - Target version
 * @returns {Array} - Array of {text, level, type} objects
 */
function extractReleaseDescription(content, version) {
  const escapedVersion = version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const sectionMatch = content.match(new RegExp(`^## \\[${escapedVersion}\\][^\\n]*\\n+>\\s*(.+)$`, 'm'));
  return sectionMatch ? sectionMatch[1].trim() : '';
}
function parseChangelogToStructured(content, version) {
  // Match the version header (e.g., "## [1.8.3] - 2026-04-26")
  const versionRegex = new RegExp(`^## \\[${version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\]`, 'm');
  const lines = content.split('\n');
  let inSection = false;
  const result = [];
  let currentSectionType = null;
  let currentIndent = 0;

  const SECTION_TYPES = ['Added', 'Fixed', 'Changed', 'Removed', 'Refactored', 'Improved', 'Deprecated', 'Docs', 'Security'];

  for (const line of lines) {
    // Check if we've entered the target version section
    if (versionRegex.test(line)) {
      inSection = true;
      continue;
    }

    // Check if we've entered another version section (stop here)
    if (inSection && line.startsWith('## [')) {
      break;
    }

    if (inSection) {
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith('>')) continue;

      // Detect section header (### Added, **✨ Added**, etc.)
      const sectionMatch = trimmed.match(/^(?:###|##?\*?)\s*(?:\*\*)?([A-Za-z\u00C0-\u024F ]+)(?:\*\*)?:?\s*$/);
      if (sectionMatch || trimmed.match(/^\*\*?[A-Z][a-z]+(?: [a-z]+)?\*\*?:?\s*$/)) {
        const type = sectionMatch ? sectionMatch[1].trim() : trimmed.replace(/\*\*|[:]/g, '').trim();
        if (SECTION_TYPES.some(t => type.toLowerCase().includes(t.toLowerCase()))) {
          currentSectionType = type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
        } else {
          currentSectionType = 'Other';
        }
        continue;
      }

      // Calculate indent level
      const indent = (line.match(/^(\s*)/) || [''])[1].length;
      const level = indent === 0 ? 0 : Math.min(Math.floor(indent / 2), 2) + 1;

      // Extract text - remove list markers (-, *, •, ▸)
      const textMatch = trimmed.match(/^[-*•▸]\s*(.+)$/) || trimmed.match(/^\s*(.+)$/);
      if (textMatch && textMatch[1]) {
        const text = textMatch[1]
          .replace(/\*\*(.+?)\*\*/g, '$1')  // Remove bold markers
          .replace(/`(.+?)`/g, '$1')         // Remove code markers
          .replace(/^\*\*(.+?)\*\*/, '$1')   // Remove bold at start
          .replace(/^[\p{Emoji_Presentation}\p{Extended_Pictographic}]\s*/u, '') // Remove emoji at start
          .replace(/^\[([^\]]+)\]:?\s*/, '$1: ') // Handle [tag]: format
          .trim();

        if (text) {
          result.push({
            text: text,
            level: level,
            type: currentSectionType || 'Changed'
          });
        }
      }
    }
  }

  return result;
}

/**
 * Extract a short description from changelog items
 * @param {Array} changelog - Parsed changelog items
 * @returns {string} - Short description
 */
function extractDescription(changelog) {
  // Find first main-level item (level 0 or 1)
  const firstItem = changelog.find(item => item.level <= 1);
  if (firstItem) {
    // Truncate if too long
    const text = firstItem.text;
    return text.length > 100 ? text.substring(0, 97) + '...' : text;
  }
  return 'Bug fixes and improvements';
}

if (require.main === module) {
  registerVersion();
}

module.exports = { extractReleaseDescription, parseChangelogToStructured };

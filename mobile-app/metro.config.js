const { getDefaultConfig } = require('expo/metro-config');

const defaultConfig = getDefaultConfig(__dirname);

// Add 'cjs' to the list of source extensions
// This helps Metro recognize .cjs modules used by Firebase
defaultConfig.resolver.sourceExts.push('cjs');

// Disable unstable package exports to avoid conflicts
defaultConfig.resolver.unstable_enablePackageExports = false;

module.exports = defaultConfig;


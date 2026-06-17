const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Explicitly ensure webp is treated as an asset (transparent webp for mascot)
if (!config.resolver.assetExts.includes('webp')) {
  config.resolver.assetExts.push('webp');
}

module.exports = config;

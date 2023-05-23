export const defaultConfig = {
  fileMatch: ['(^|/)bin/hermit$'],
  filePatterns: ['**/bin/hermit'], // not used yet
  // bin/hermit will be changed to trigger artifact update
  // but it doesn't need to be committed
  excludeCommitPaths: ['**/bin/hermit'],
};

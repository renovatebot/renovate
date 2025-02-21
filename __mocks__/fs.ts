import { readFileSync } from 'fs';
import { fs } from 'memfs';

module.exports = {
  ...fs,
  readFileSync(path, options) {
    if (typeof path === 'string') {
      if (path.endsWith('.wasm')) {
        return readFileSync(path, options);
      }
    }

    return fs.readFileSync(path, options);
  },
};

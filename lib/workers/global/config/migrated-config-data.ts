import type { RenovateConfig } from '../../../config/types';

let configContent: RenovateConfig;
let configFileName: string;
let configIndent: string;

export default {
  set(fileName: string, config: RenovateConfig) {
    configContent = config;
    configFileName = fileName;
  },
  getConfigContent(): string {
    return JSON.stringify(configContent, undefined, configIndent) + '\n';
  },
  getConfigFileName(): string {
    return configFileName;
  },
  setIndent(s: string) {
    configIndent = s || '    ';
  },
  getIndent(): string {
    return configIndent;
  },
};

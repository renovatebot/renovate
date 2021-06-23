import os from 'os';
import fs from 'fs-extra';
import ini from 'ini';
import { join } from 'upath';
import { AllConfig } from '../../../../config/types';
import { logger } from '../../../../logger';

export interface HomeDirConfig {
  fileList: string[];
  config: AllConfig;
}

export async function readHomeDirFiles(): Promise<HomeDirConfig | null> {
  const fileList: string[] = [];
  const config: AllConfig = { hostRules: [], packageRules: [] };
  const homeDir = os.homedir();
  const npmrcFileName = join(homeDir, '.npmrc');
  let npmrcContent: string;
  try {
    npmrcContent = await fs.readFile(npmrcFileName, 'utf8');
  } catch (err) {
    // Ignore
  }
  if (npmrcContent) {
    fileList.push(npmrcFileName);
    try {
      const npmrc = ini.parse(npmrcContent);
      if (npmrc.registry) {
        config.packageRules.push({
          matchDatasources: ['npm'],
          registryUrls: [npmrc.registry],
        });
      }
      if (npmrc._authToken) {
        config.hostRules.push({ hostType: 'npm', token: npmrc._authToken });
      }
      if (npmrc._auth) {
        config.hostRules.push({
          hostType: 'npm',
          token: npmrc._auth,
          authType: 'Basic',
        });
      }
      for (const [key, val] of Object.entries(npmrc)) {
        const [scope, topic] = key.split(':');
        if (topic === 'registry') {
          config.packageRules.push({
            matchDatasources: ['npm'],
            matchPackagePrefixes: [scope],
            registryUrls: [val],
          });
        }
        if (topic === '_authToken') {
          const matchHost = scope.replace(/^\/\//, 'https://');
          config.hostRules.push({ matchHost, token: val });
        }
        if (topic === '_auth') {
          const matchHost = scope.replace(/^\/\//, 'https://');
          config.hostRules.push({
            matchHost,
            token: val,
            authType: 'Basic',
          });
        }
      }
    } catch (err) /* istanbul ignore next */ {
      logger.debug({ npmrcFileName, err }, 'Error parsing .npmrc');
    }
  }
  if (fileList.length) {
    return { fileList, config };
  }
  return null;
}

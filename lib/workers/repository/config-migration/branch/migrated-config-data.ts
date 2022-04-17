import detectIndent from 'detect-indent';
import { migrateAndValidate } from '../../../../config/migrate-validate';
import type { RenovateConfig } from '../../../../config/types';
import { logger } from '../../../../logger';
import { readLocalFile } from '../../../../util/fs';
import { detectRepoFileConfig } from '../../init/merge';

export interface MigratedConfigData {
  init(config: RenovateConfig): Promise<void>;

  getConfigContent(): string;

  getConfigFileName(): string;

  getIndent(): string;
}

let content: string;
let fileName: string;
let indent: string;
let initialized = false;

async function init(config: RenovateConfig): Promise<void> {
  try {
    const rc = await detectRepoFileConfig();
    const configFileParsed = rc?.configFileParsed || {};
    const migratedConfig = await migrateAndValidate(config, configFileParsed);
    const rawFileContents = await readLocalFile(rc.configFileName, 'utf8');

    indent = detectIndent(rawFileContents).indent ?? '  ';
    fileName = rc.configFileName;
    content = JSON.stringify(migratedConfig, undefined, indent) + '\n';
    initialized = true;
  } catch (err) {
    logger.debug(err, 'Error initializing renovate MigratedConfigData');
  }
}

function getConfigContent(): string | null {
  return initialized ? content : null;
}

function getConfigFileName(): string | null {
  return initialized ? fileName : null;
}

function getIndent(): string | null {
  return initialized ? indent : null;
}

export const migratedConfigData: MigratedConfigData = {
  init,
  getConfigContent,
  getConfigFileName,
  getIndent,
};

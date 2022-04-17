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

  finalize(): void;
}

let content: string;
let fileName: string;
let indent: string;
let initialized = false;

async function init(config_: RenovateConfig): Promise<void> {
  try {
    if (initialized) {
      logger.debug('init(): MigratedConfigData is already initialed');
      return;
    }
    const config = { ...config_ };
    const rc = await detectRepoFileConfig();
    const configFileParsed = rc?.configFileParsed || {};

    // get migrated config
    const migrated = await migrateAndValidate(config, configFileParsed);
    delete migrated.errors;
    delete migrated.warnings;

    const raw = await readLocalFile(rc.configFileName, 'utf8');

    // indent defaults to 2 spaces
    indent = detectIndent(raw).indent ?? '  ';
    fileName = rc.configFileName;
    content = JSON.stringify(migrated, undefined, indent) + '\n';

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

function finalize(): void {
  content = null;
  fileName = null;
  indent = null;
  initialized = false;
}

export const migratedConfigData: MigratedConfigData = {
  init,
  getConfigContent,
  getConfigFileName,
  getIndent,
  finalize,
};

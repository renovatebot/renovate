import detectIndent from 'detect-indent';
import { migrateAndValidate } from '../../../../config/migrate-validate';
import type { RenovateConfig } from '../../../../config/types';
import { logger } from '../../../../logger';
import { readLocalFile } from '../../../../util/fs';
import { detectRepoFileConfig } from '../../init/merge';

export class MigratedData {
  constructor(
    private readonly _content: string,
    private readonly _fileName: string,
    private readonly _indent: string
  ) {}

  getConfigContent(): string {
    return this._content;
  }

  getConfigFileName(): string {
    return this._fileName;
  }

  getIndent(): string {
    return this._indent;
  }
}

export class MigratedDataFactory {
  // singleton
  private static _data: MigratedData;

  public static async getAsync(config_: RenovateConfig): Promise<MigratedData> {
    if (this._data) {
      return this._data;
    }
    const d = await this.build(config_);
    this._data = new MigratedData(d?.content, d?.fileName, d?.indent);
    return this._data;
  }

  public static reset(): void {
    this._data = null;
  }

  // istanbul ignore next: unused constructor for a static factory class
  private constructor() {
    return;
  }

  private static async build(
    config_: RenovateConfig
  ): Promise<IMigratedData | null> {
    let res: IMigratedData;
    try {
      const config = { ...config_ };
      const rc = await detectRepoFileConfig();
      const configFileParsed = rc?.configFileParsed || {};

      // get migrated config
      const migrated = await migrateAndValidate(config, configFileParsed);
      delete migrated.errors;
      delete migrated.warnings;

      const raw = await readLocalFile(rc.configFileName, 'utf8');

      // indent defaults to 2 spaces
      const indent = detectIndent(raw).indent ?? '  ';
      const fileName = rc.configFileName;
      let content = JSON.stringify(migrated, undefined, indent);
      if (!content.endsWith('\n')) {
        content += '\n';
      }

      res = { content, fileName, indent };
    } catch (err) {
      logger.debug(
        err,
        'MigratedDataFactory.getAsync() Error initializing renovate MigratedData'
      );
    }
    return res;
  }
}

interface IMigratedData {
  content: string;
  fileName: string;
  indent: string;
}

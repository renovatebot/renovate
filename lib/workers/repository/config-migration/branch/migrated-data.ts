import detectIndent from 'detect-indent';
import { migrateAndValidate } from '../../../../config/migrate-validate';
import type { RenovateConfig } from '../../../../config/types';
import { logger } from '../../../../logger';
import { readLocalFile } from '../../../../util/fs';
import { detectRepoFileConfig } from '../../init/merge';

export class MigratedData {
  constructor(
    private readonly migratedContent: string,
    private readonly configFileName: string
  ) {}

  get content(): string {
    return this.migratedContent;
  }

  get fileName(): string {
    return this.configFileName;
  }
}

export class MigratedDataFactory {
  // singleton
  private static data: MigratedData;

  public static async getAsync(config: RenovateConfig): Promise<MigratedData> {
    if (this.data) {
      return this.data;
    }
    const migrated = await this.build(config);
    this.data = new MigratedData(migrated?.content, migrated?.fileName);
    return this.data;
  }

  public static reset(): void {
    this.data = null;
  }

  private static async build(
    config: RenovateConfig
  ): Promise<IMigratedData | null> {
    let res: IMigratedData;
    try {
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

      res = { content, fileName };
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
}

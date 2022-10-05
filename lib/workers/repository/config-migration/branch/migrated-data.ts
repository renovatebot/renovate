import detectIndent from 'detect-indent';
import JSON5 from 'json5';
import prettier from 'prettier';
import { migrateConfig } from '../../../../config/migration';
import { logger } from '../../../../logger';
import { readLocalFile } from '../../../../util/fs';
import { getFileList } from '../../../../util/git';
import { detectRepoFileConfig } from '../../init/merge';

export interface MigratedData {
  content: string;
  filename: string;
}

interface Indent {
  amount: number;
  indent: string;
  type?: string;
}

const prettierConfigFilenames = new Set([
  '.prettierrc',
  '.prettierrc.json',
  '.prettierrc.yml',
  '.prettierrc.yaml',
  '.prettierrc.json5',
  '.prettierrc.js',
  '.prettierrc.cjs',
  'prettier.config.js',
  'prettier.config.cjs',
  '.prettierrc.toml',
]);

export class MigratedDataFactory {
  // singleton
  private static data: MigratedData | null;
  private static indent: Indent;

  public static async getAsync(): Promise<MigratedData | null> {
    if (this.data) {
      return this.data;
    }
    const migrated = await this.build();

    if (!migrated) {
      return null;
    }

    this.data = migrated;
    return this.data;
  }

  public static async applyPrettierFormatting(): Promise<string | null> {
    logger.trace('applyPrettierFormatting() - START');
    if (!this.data) {
      return null;
    }

    const { content, filename } = this.data;
    const indent = this.indent;
    const fileList = await getFileList();
    let prettierExists = fileList.some((file) =>
      prettierConfigFilenames.has(file)
    );

    if (!prettierExists) {
      try {
        const packageJsonContent = await readLocalFile('package.json', 'utf8');
        prettierExists =
          packageJsonContent && JSON.parse(packageJsonContent).prettier;
      } catch {
        logger.warn(
          'applyPrettierFormatting() - Error processing package.json file'
        );
      }
    }

    if (!prettierExists) {
      return content;
    }
    const options = {
      parser: filename.endsWith('.json5') ? 'json5' : 'json',
      tabWidth: indent.amount === 0 ? 2 : indent.amount,
      useTabs: indent.type === 'tab',
    };

    logger.trace('applyPrettierFormatting() - END');
    return prettier.format(content, options);
  }

  public static reset(): void {
    this.data = null;
  }

  private static async build(): Promise<MigratedData | null> {
    let res: MigratedData | null = null;
    try {
      const {
        configFileName,
        configFileRaw: raw,
        configFileParsed = {},
      } = await detectRepoFileConfig();

      // get migrated config
      const { isMigrated, migratedConfig } = migrateConfig(configFileParsed);
      if (!isMigrated) {
        return null;
      }

      delete migratedConfig.errors;
      delete migratedConfig.warnings;

      // indent defaults to 2 spaces
      // TODO #7154
      this.indent = detectIndent(raw!);
      const indentSpace = this.indent.indent ?? '  ';
      const filename = configFileName!;
      let content: string;

      if (filename.endsWith('.json5')) {
        content = JSON5.stringify(migratedConfig, undefined, indentSpace);
      } else {
        content = JSON.stringify(migratedConfig, undefined, indentSpace);
      }

      if (!content.endsWith('\n')) {
        content += '\n';
      }

      res = { content, filename };
    } catch (err) {
      logger.debug(
        { err },
        'MigratedDataFactory.getAsync() Error initializing renovate MigratedData'
      );
    }
    return res;
  }
}

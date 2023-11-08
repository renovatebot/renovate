import detectIndent from 'detect-indent';
import JSON5 from 'json5';
import type { BuiltInParserName } from 'prettier';
import upath from 'upath';
import { migrateConfig } from '../../../../config/migration';
import { prettier } from '../../../../expose.cjs';
import { logger } from '../../../../logger';
import { scm } from '../../../../modules/platform/scm';
import { readLocalFile } from '../../../../util/fs';
import { detectRepoFileConfig } from '../../init/merge';

export interface MigratedData {
  content: string;
  filename: string;
  indent: Indent;
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

export type PrettierParser = BuiltInParserName;

export async function applyPrettierFormatting(
  content: string,
  parser: PrettierParser,
  indent?: Indent,
): Promise<string> {
  try {
    logger.trace('applyPrettierFormatting - START');
    const fileList = await scm.getFileList();
    let prettierExists = fileList.some((file) =>
      prettierConfigFilenames.has(file),
    );

    if (!prettierExists) {
      try {
        const packageJsonContent = await readLocalFile('package.json', 'utf8');
        prettierExists =
          packageJsonContent && JSON.parse(packageJsonContent).prettier;
      } catch {
        logger.warn(
          'applyPrettierFormatting - Error processing package.json file',
        );
      }
    }

    if (!prettierExists) {
      return content;
    }
    const options = {
      parser,
      tabWidth: indent?.amount === 0 ? 2 : indent?.amount,
      useTabs: indent?.type === 'tab',
    };

    return prettier().format(content, options);
  } finally {
    logger.trace('applyPrettierFormatting - END');
  }
}

export class MigratedDataFactory {
  // singleton
  private static data: MigratedData | null;

  static async getAsync(): Promise<MigratedData | null> {
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

  static reset(): void {
    this.data = null;
  }

  static applyPrettierFormatting({
    content,
    filename,
    indent,
  }: MigratedData): Promise<string> {
    const parser = upath.extname(filename).replace('.', '') as PrettierParser;
    return applyPrettierFormatting(content, parser, indent);
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
      // TODO #22198
      const indent = detectIndent(raw!);
      const indentSpace = indent.indent ?? '  ';
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

      res = { content, filename, indent };
    } catch (err) {
      logger.debug(
        { err },
        'MigratedDataFactory.getAsync() Error initializing renovate MigratedData',
      );
    }
    return res;
  }
}

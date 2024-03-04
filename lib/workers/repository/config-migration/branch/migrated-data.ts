import is from '@sindresorhus/is';
import detectIndent from 'detect-indent';
import JSON5 from 'json5';
import type { BuiltInParserName, Options } from 'prettier';
import upath from 'upath';
import { migrateConfig } from '../../../../config/migration';
import { prettier } from '../../../../expose.cjs';
import { logger } from '../../../../logger';
import { platform } from '../../../../modules/platform';
import { scm } from '../../../../modules/platform/scm';
import { readLocalFile } from '../../../../util/fs';
import { EditorConfig } from '../../../../util/json-writer';
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
  filename: string,
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

    const editorconfigExists = fileList.some(
      (file) => file === '.editorconfig',
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

    const options: Options = {
      parser,
      tabWidth: indent?.amount === 0 ? 2 : indent?.amount,
      useTabs: indent?.type === 'tab',
    };

    if (editorconfigExists) {
      const editorconf = await EditorConfig.getCodeFormat(filename);

      // https://github.com/prettier/prettier/blob/bab892242a1f9d8fcae50514b9304bf03f2e25ab/src/config/editorconfig/editorconfig-to-prettier.js#L47
      if (editorconf.maxLineLength) {
        options.printWidth = is.number(editorconf.maxLineLength)
          ? editorconf.maxLineLength
          : Number.POSITIVE_INFINITY;
      }

      // TODO: support editor config `indent_style` and `indent_size`
    }

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
    return applyPrettierFormatting(filename, content, parser, indent);
  }

  private static async build(): Promise<MigratedData | null> {
    let res: MigratedData | null = null;
    try {
      const { configFileName, configFileParsed = {} } =
        await detectRepoFileConfig();

      // get migrated config
      const { isMigrated, migratedConfig } = migrateConfig(configFileParsed);
      if (!isMigrated) {
        return null;
      }

      delete migratedConfig.errors;
      delete migratedConfig.warnings;

      // TODO #22198
      const raw = await platform.getRawFile(configFileName!);
      const indent = detectIndent(raw ?? '');
      // indent defaults to 2 spaces
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

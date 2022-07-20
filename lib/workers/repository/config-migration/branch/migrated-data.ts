import detectIndent from 'detect-indent';
import JSON5 from 'json5';
import prettier from 'prettier';
import { migrateConfig } from '../../../../config/migration';
import type { RepositoryCacheConfig } from '../../../../config/types';
import { logger } from '../../../../logger';
import { platform } from '../../../../modules/platform';
import { getCache } from '../../../../util/cache/repository';
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

export async function applyPrettierFormatting(
  content: string,
  parser: string,
  indent: Indent
): Promise<string> {
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
      logger.warn('Invalid JSON found in package.json');
    }
  }

  if (!prettierExists) {
    return content;
  }
  const options = {
    parser,
    tabWidth: indent.amount === 0 ? 2 : indent.amount,
    useTabs: indent.type === 'tab',
  };

  return prettier.format(content, options);
}

export class MigratedDataFactory {
  // singleton
  private static data: MigratedData | null;
  private static repoCacheEnabled: boolean;

  public static async getAsync(
    repoCache: RepositoryCacheConfig = 'disabled'
  ): Promise<MigratedData | null> {
    this.repoCacheEnabled = repoCache !== 'disabled';

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

  public static reset(): void {
    this.data = null;
  }

  private static async build(): Promise<MigratedData | null> {
    let res: MigratedData | null = null;
    try {
      const rc = await detectRepoFileConfig();
      const configFileParsed = rc?.configFileParsed || {};

      // get migrated config
      const { isMigrated, migratedConfig } = migrateConfig(configFileParsed);
      if (!isMigrated) {
        return null;
      }

      delete migratedConfig.errors;
      delete migratedConfig.warnings;

      const filename = rc.configFileName ?? '';

      let raw: string | null;
      if (this.repoCacheEnabled && filename === getCache().configFileName) {
        raw = await platform.getRawFile(filename);
      } else {
        raw = await readLocalFile(filename, 'utf8');
      }
      if (!raw) {
        logger.debug(
          'MigratedDataFactory.getAsync() Error retrieving repo config'
        );
        return null;
      }

      // indent defaults to 2 spaces
      // TODO #7154
      const indent = detectIndent(raw);
      const indentSpace = indent.indent ?? '  ';
      let content: string;

      if (filename.endsWith('.json5')) {
        content = JSON5.stringify(migratedConfig, undefined, indentSpace);
      } else {
        content = JSON.stringify(migratedConfig, undefined, indentSpace);
      }

      // format if prettier is found in the user's repo
      content = await applyPrettierFormatting(
        content,
        filename.endsWith('.json5') ? 'json5' : 'json',
        indent
      );
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

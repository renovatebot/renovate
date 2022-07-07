import is from '@sindresorhus/is';
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

async function applyPrettierFormatting(
  content: string,
  fileName: string
): Promise<string> {
  const prettierConfigFilenames = [
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
  ];
  let prettierExists = (await getFileList()).some((file) =>
    prettierConfigFilenames.includes(file)
  );
  const packageJsonContent = await readLocalFile('package.json', 'utf8');
  prettierExists ||=
    packageJsonContent && JSON.parse(packageJsonContent).prettier;

  let newContent = content;

  if (prettierExists) {
    const options = await prettier.resolveConfig('.prettierrc'); // renovate's prettierrc config
    if (!is.null_(options)) {
      newContent = prettier.format(content, {
        filepath: fileName,
        ...options,
      });
    }
  }

  return newContent;
}

export class MigratedDataFactory {
  // singleton
  private static data: MigratedData | null;

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
      const raw = await readLocalFile(filename, 'utf8');

      // indent defaults to 2 spaces
      // TODO #7154
      const indent = detectIndent(raw!).indent ?? '  ';
      let content: string;

      if (filename.endsWith('.json5')) {
        content = JSON5.stringify(migratedConfig, undefined, indent);
      } else {
        content = JSON.stringify(migratedConfig, undefined, indent);
      }

      content = await applyPrettierFormatting(content, filename);
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

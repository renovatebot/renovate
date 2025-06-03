import fs from 'node:fs/promises';
import editorconfig from 'editorconfig';
import type { DirectoryResult } from 'tmp-promise';
import { dir } from 'tmp-promise';
import { configFileNames } from '../../config/app-strings';
import { GlobalConfig } from '../../config/global';
import { EditorConfig } from './editor-config';
import { Fixtures } from '~test/fixtures';

// We can't use memfs, because `node:*` modules are not easily mockable
vi.mock('editorconfig', { spy: true });

const defaultConfigFile = configFileNames[0];

describe('util/json-writer/editor-config', () => {
  let tmpDir: DirectoryResult | null;

  beforeEach(async () => {
    tmpDir = await dir({ unsafeCleanup: true });

    GlobalConfig.set({
      localDir: tmpDir.path,
    });
  });

  afterEach(async () => {
    await tmpDir?.cleanup();
    tmpDir = null;
  });

  it('should handle empty .editorconfig file', async () => {
    await fs.writeFile(`${tmpDir!.path}/.editorconfig`, '');
    const format = await EditorConfig.getCodeFormat(defaultConfigFile);

    expect(format.indentationSize).toBeUndefined();
    expect(format.indentationType).toBeUndefined();
    expect(format.maxLineLength).toBeUndefined();
  });

  it('should handle global config from .editorconfig', async () => {
    await fs.writeFile(
      `${tmpDir!.path}/.editorconfig`,
      Fixtures.get('.global_editorconfig'),
    );
    const format = await EditorConfig.getCodeFormat(defaultConfigFile);
    expect(format.indentationSize).toBe(6);
    expect(format.indentationType).toBe('space');
    expect(format.maxLineLength).toBe(160);
  });

  it('should return undefined in case of exception', async () => {
    vi.mocked(editorconfig).parse.mockRejectedValueOnce(new Error('something'));
    const format = await EditorConfig.getCodeFormat(defaultConfigFile);

    expect(format.indentationSize).toBeUndefined();
    expect(format.indentationType).toBeUndefined();
  });

  it('should not handle non json config from .editorconfig', async () => {
    await fs.writeFile(
      `${tmpDir!.path}/.editorconfig`,
      Fixtures.get('.non_json_editorconfig'),
    );
    const format = await EditorConfig.getCodeFormat(defaultConfigFile);

    expect(format.indentationSize).toBeUndefined();
    expect(format.indentationType).toBeUndefined();
  });

  it('should handle json config from .editorconfig', async () => {
    await fs.writeFile(
      `${tmpDir!.path}/.editorconfig`,
      Fixtures.get('.json_editorconfig'),
    );
    const format = await EditorConfig.getCodeFormat(defaultConfigFile);

    expect(format.indentationType).toBe('tab');
    expect(format.maxLineLength).toBe('off');
  });
});

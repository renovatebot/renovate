import { fs as memfs } from 'memfs';
import { Fixtures } from '../../../test/fixtures';
import { configFileNames } from '../../config/app-strings';
import { GlobalConfig } from '../../config/global';
import { EditorConfig } from './editor-config';
import { IndentationType } from './indentation-type';

// use real fs to read wasm files for `@one-ini/wasm`
jest.mock('fs', () => ({
  ...memfs,
  readFileSync: (file: string, ...args: any[]) => {
    if (file.endsWith('.wasm')) {
      const realFs = jest.requireActual<typeof import('fs')>('fs');
      return realFs.readFileSync(file, ...args);
    }
    return memfs.readFileSync(file, ...args);
  },
}));

const defaultConfigFile = configFileNames[0];

describe('util/json-writer/editor-config', () => {
  beforeAll(() => {
    GlobalConfig.set({
      localDir: '',
    });
  });

  beforeEach(() => {
    Fixtures.reset();
  });

  it('should handle empty .editorconfig file', async () => {
    expect.assertions(2);
    Fixtures.mock({
      '.editorconfig': '',
    });
    const format = await EditorConfig.getCodeFormat(defaultConfigFile);

    expect(format.indentationSize).toBeUndefined();
    expect(format.indentationType).toBeUndefined();
  });

  it('should handle global config from .editorconfig', async () => {
    expect.assertions(2);
    Fixtures.mock({
      '.editorconfig': Fixtures.get('.global_editorconfig'),
    });
    const format = await EditorConfig.getCodeFormat(defaultConfigFile);
    expect(format.indentationSize).toBe(6);
    expect(format.indentationType).toBe(IndentationType.Space);
  });

  // temporary ignoring error https://github.com/renovatebot/renovate/issues/18540
  it('should temporary give undefined until its fixed on the library', async () => {
    expect.assertions(2);
    Fixtures.mock({
      '.editorconfig': Fixtures.get('.customer_file'),
    });
    const format = await EditorConfig.getCodeFormat(defaultConfigFile);

    expect(format.indentationSize).toBeUndefined();
    expect(format.indentationType).toBeUndefined();
  });

  it('should not handle non json config from .editorconfig', async () => {
    expect.assertions(2);
    Fixtures.mock({
      '.editorconfig': Fixtures.get('.non_json_editorconfig'),
    });
    const format = await EditorConfig.getCodeFormat(defaultConfigFile);

    expect(format.indentationSize).toBeUndefined();
    expect(format.indentationType).toBeUndefined();
  });

  it('should handle json config from .editorconfig', async () => {
    expect.assertions(1);
    Fixtures.mock({
      '.editorconfig': Fixtures.get('.json_editorconfig'),
    });
    const format = await EditorConfig.getCodeFormat(defaultConfigFile);

    expect(format.indentationType).toBe(IndentationType.Tab);
  });
});

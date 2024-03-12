import { fs as memfs } from 'memfs';
import { Fixtures } from '../../../test/fixtures';
import { configFileNames } from '../../config/app-strings';
import { GlobalConfig } from '../../config/global';
import { EditorConfig } from './editor-config';

// use real fs to read wasm files for `@one-ini/wasm`
jest.mock('fs', () => {
  const realFs = jest.requireActual<typeof import('fs')>('fs');
  return {
    ...memfs,
    readFileSync: (file: string, ...args: any[]) => {
      if (file.endsWith('.wasm')) {
        return realFs.readFileSync(file, ...args);
      }
      return memfs.readFileSync(file, ...args);
    },
  };
});

const defaultConfigFile = configFileNames[0];

describe('util/json-writer/editor-config', () => {
  beforeAll(() => {
    GlobalConfig.set({
      localDir: '',
    });
  });

  beforeEach(() => {
    jest.restoreAllMocks();
    Fixtures.reset();
  });

  it('should handle empty .editorconfig file', async () => {
    Fixtures.mock({
      '.editorconfig': '',
    });
    const format = await EditorConfig.getCodeFormat(defaultConfigFile);

    expect(format.indentationSize).toBeUndefined();
    expect(format.indentationType).toBeUndefined();
    expect(format.maxLineLength).toBeUndefined();
  });

  it('should handle global config from .editorconfig', async () => {
    Fixtures.mock({
      '.editorconfig': Fixtures.get('.global_editorconfig'),
    });
    const format = await EditorConfig.getCodeFormat(defaultConfigFile);
    expect(format.indentationSize).toBe(6);
    expect(format.indentationType).toBe('space');
    expect(format.maxLineLength).toBe(160);
  });

  it('should return undefined in case of exception', async () => {
    Fixtures.mock({
      '.editorconfig': Fixtures.get('.global_editorconfig'),
    });
    const editorconf = await import('editorconfig');
    jest
      .spyOn(editorconf, 'parse')
      .mockImplementationOnce(new Error('something') as never);

    const format = await EditorConfig.getCodeFormat(defaultConfigFile);

    expect(format.indentationSize).toBeUndefined();
    expect(format.indentationType).toBeUndefined();
  });

  it('should not handle non json config from .editorconfig', async () => {
    Fixtures.mock({
      '.editorconfig': Fixtures.get('.non_json_editorconfig'),
    });
    const format = await EditorConfig.getCodeFormat(defaultConfigFile);

    expect(format.indentationSize).toBeUndefined();
    expect(format.indentationType).toBeUndefined();
  });

  it('should handle json config from .editorconfig', async () => {
    Fixtures.mock({
      '.editorconfig': Fixtures.get('.json_editorconfig'),
    });
    const format = await EditorConfig.getCodeFormat(defaultConfigFile);

    expect(format.indentationType).toBe('tab');
    expect(format.maxLineLength).toBe('off');
  });
});

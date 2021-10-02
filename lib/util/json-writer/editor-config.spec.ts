import mock from 'mock-fs';
import { loadFixture } from '../../../test/util';
import { configFileNames } from '../../config/app-strings';
import { EditorConfig } from './editor-config';
import { IndentationType } from './indentation-type';

const defaultConfigFile = configFileNames[0];

const GLOBAL_EDITOR_CONFIG = loadFixture('.global_editorconfig', '.');
const JSON_FILES_EDITOR_CONFIG = loadFixture('.json_editorconfig', '.');
const NON_JSON_FILES_EDITOR_CONFIG = loadFixture('.non_json_editorconfig', '.');

describe('util/json-writer/editor-config', () => {
  afterEach(() => {
    mock.restore();
  });

  it('should handle empty .editorconfig file', async () => {
    expect.assertions(2);
    mock({
      '.editorconfig': '',
    });
    const format = await EditorConfig.getCodeFormat(defaultConfigFile);

    expect(format.indentationSize).toBeUndefined();
    expect(format.indentationType).toBeUndefined();
  });

  it('should handle global config from .editorconfig', async () => {
    expect.assertions(2);
    mock({
      '.editorconfig': GLOBAL_EDITOR_CONFIG,
    });
    const format = await EditorConfig.getCodeFormat(defaultConfigFile);
    expect(format.indentationSize).toBe(6);
    expect(format.indentationType).toBe(IndentationType.Space);
  });

  it('should not handle non json config from .editorconfig', async () => {
    expect.assertions(2);
    mock({
      '.editorconfig': NON_JSON_FILES_EDITOR_CONFIG,
    });
    const format = await EditorConfig.getCodeFormat(defaultConfigFile);

    expect(format.indentationSize).toBeUndefined();
    expect(format.indentationType).toBeUndefined();
  });

  it('should handle json config from .editorconfig', async () => {
    expect.assertions(2);
    mock({
      '.editorconfig': JSON_FILES_EDITOR_CONFIG,
    });
    const format = await EditorConfig.getCodeFormat(defaultConfigFile);

    expect(format.indentationType).toBe(IndentationType.Tab);
  });
});

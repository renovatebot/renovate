import mock from 'mock-fs';
import { configFileNames } from '../../config/app-strings';
import { EditorConfig } from './editor-config';
import { IndentationType } from './indentation-type';

const defaultConfigFile = configFileNames[0];

const GLOBAL_EDITOR_CONFIG = `
  [*]
  indent_style = space
  indent_size = 6
`;

const JSON_FILES_EDITOR_CONFIG = `
  [*.json]
  indent_style = tab
`;

const NON_JSON_FILES_EDITOR_CONFIG = `
  [*.py]
  indent_style = space
  indent_size = 6
`;

describe('util/json-writer/editor-config', () => {
  afterEach(() => {
    mock.restore();
  });

  it('should handle empty .editorconfig file', () => {
    mock({
      '.editorconfig': '',
    });
    const format = EditorConfig.getCodeFormat(defaultConfigFile);

    expect(format.indentationSize).toBeUndefined();
    expect(format.indentationType).toBeUndefined();
  });

  it('should handle global config from .editorconfig', () => {
    mock({
      '.editorconfig': GLOBAL_EDITOR_CONFIG,
    });
    const format = EditorConfig.getCodeFormat(defaultConfigFile);
    expect(format.indentationSize).toBe(6);
    expect(format.indentationType).toBe(IndentationType.Space);
  });

  it('should not handle non json config from .editorconfig', () => {
    mock({
      '.editorconfig': NON_JSON_FILES_EDITOR_CONFIG,
    });
    const format = EditorConfig.getCodeFormat(defaultConfigFile);

    expect(format.indentationSize).toBeUndefined();
    expect(format.indentationType).toBeUndefined();
  });

  it('should handle json config from .editorconfig', () => {
    mock({
      '.editorconfig': JSON_FILES_EDITOR_CONFIG,
    });
    const format = EditorConfig.getCodeFormat(defaultConfigFile);

    expect(format.indentationType).toBe(IndentationType.Tab);
  });
});

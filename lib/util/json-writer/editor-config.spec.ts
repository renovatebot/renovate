import { fs } from '../../../test/util';
import { configFileNames } from '../../config/app-strings';
import { EditorConfig } from './editor-config';
import { IndentationType } from './indentation-type';

jest.mock('../../util/fs');

const defaultConfigFile = configFileNames[0];

const GLOBAL_EDITOR_CONFIG = `
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
  beforeEach(() => {
    EditorConfig.reset();
  });

  it('should return instance of EditorConfig even if ".editorconfig" file does not exist', async () => {
    expect.assertions(3);
    const instance = await EditorConfig.getInstance();

    expect(instance).toBeInstanceOf(EditorConfig);
    const format = instance.getCodeFormat(defaultConfigFile);
    expect(format.indentationSize).toBeUndefined();
    expect(format.indentationType).toBeUndefined();
  });

  it('should handle reading .editorconfig file error', async () => {
    expect.assertions(3);
    fs.localPathExists.mockResolvedValueOnce(true);
    fs.readLocalFile.mockRejectedValueOnce('test');
    const instance = await EditorConfig.getInstance();

    expect(instance).toBeInstanceOf(EditorConfig);
    const format = instance.getCodeFormat(defaultConfigFile);
    expect(format.indentationSize).toBeUndefined();
    expect(format.indentationType).toBeUndefined();
  });

  it('should handle global config from .editorconfig', async () => {
    expect.assertions(2);
    fs.localPathExists.mockResolvedValueOnce(true);
    fs.readLocalFile.mockResolvedValueOnce(GLOBAL_EDITOR_CONFIG);
    const instance = await EditorConfig.getInstance();
    const format = instance.getCodeFormat(defaultConfigFile);
    expect(format.indentationSize).toBe(6);
    expect(format.indentationType).toBe(IndentationType.Space);
  });

  it('should not handle non json config from .editorconfig', async () => {
    expect.assertions(2);
    fs.localPathExists.mockResolvedValueOnce(true);
    fs.readLocalFile.mockResolvedValueOnce(NON_JSON_FILES_EDITOR_CONFIG);
    const instance = await EditorConfig.getInstance();
    const format = instance.getCodeFormat(defaultConfigFile);

    expect(format.indentationSize).toBeUndefined();
    expect(format.indentationType).toBeUndefined();
  });

  it('should handle json config from .editorconfig', async () => {
    expect.assertions(1);
    fs.localPathExists.mockResolvedValueOnce(true);
    fs.readLocalFile.mockResolvedValueOnce(JSON_FILES_EDITOR_CONFIG);
    const instance = await EditorConfig.getInstance();
    const format = instance.getCodeFormat(defaultConfigFile);

    expect(format.indentationType).toBe(IndentationType.Tab);
  });
});

import { KnownProps, parseString } from 'editorconfig';
import type { ParseStringResult } from 'editorconfig/src/lib/ini';
import globToRegExp from 'glob-to-regexp';
import { logger } from '../../logger/index';
import { localPathExists, readLocalFile } from '../fs';
import type { CodeFormat } from './code-format';
import { IndentationType } from './indentation-type';

export class EditorConfig {
  private readonly formats: Map<RegExp, KnownProps> = new Map();

  private static instance?: EditorConfig;

  private constructor(parseResult: ParseStringResult = []) {
    for (const [sectionName, sectionBody] of parseResult) {
      const regExp = globToRegExp(sectionName ?? '*');
      this.formats.set(regExp, sectionBody);
    }
  }

  public static async getInstance(): Promise<EditorConfig> {
    if (EditorConfig.instance === undefined) {
      const editorConfigContent = await this.getEditorConfigContent();

      if (editorConfigContent === undefined) {
        EditorConfig.instance = new EditorConfig();
      } else {
        const parseResult = parseString(editorConfigContent);
        logger.debug('.editorconfig file successfully parsed');
        EditorConfig.instance = new EditorConfig(parseResult);
      }
    }

    return EditorConfig.instance;
  }

  public static reset(): void {
    delete this.instance;
  }

  public getCodeFormat(fileName: string): CodeFormat {
    const format: CodeFormat = {};

    this.formats.forEach((sectionBody, regExp) => {
      if (regExp.test(fileName)) {
        format.indentationType = EditorConfig.getIndentationType(sectionBody);
        format.indentationSize = EditorConfig.getIndentationSize(sectionBody);
      }
    });

    return format;
  }

  private static async getEditorConfigContent(): Promise<string | undefined> {
    try {
      const isConfigExists = await localPathExists('.editorconfig');

      if (!isConfigExists) {
        logger.debug('.editorconfig file does not exist');
        return undefined;
      }

      const editorConfigContent = await readLocalFile('.editorconfig', 'utf8');
      logger.debug('.editorconfig file successfully read');
      return editorConfigContent;
    } catch (err) {
      logger.error({ err }, 'Failed to read .editorconfig file');
    }

    return undefined;
  }

  private static getIndentationType(
    knownProps: KnownProps
  ): IndentationType | undefined {
    const { indent_style: indentStyle } = knownProps;

    if (indentStyle === 'tab') {
      return IndentationType.Tab;
    }

    if (indentStyle === 'space') {
      return IndentationType.Space;
    }

    return undefined;
  }

  private static getIndentationSize(
    knownProps: KnownProps
  ): number | undefined {
    const indentSize = Number(knownProps.indent_size);

    if (!Number.isNaN(indentSize) && Number.isInteger(indentSize)) {
      return indentSize;
    }

    return undefined;
  }
}

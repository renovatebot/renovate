import { KnownProps, parse } from 'editorconfig';
import { join } from 'upath';
import { getGlobalConfig } from '../../config/global';
import type { CodeFormat } from './code-format';
import { IndentationType } from './indentation-type';

export class EditorConfig {
  public static async getCodeFormat(fileName: string): Promise<CodeFormat> {
    const { localDir } = getGlobalConfig();
    const knownProps = await parse(join(localDir, fileName));

    return {
      indentationSize: EditorConfig.getIndentationSize(knownProps),
      indentationType: EditorConfig.getIndentationType(knownProps),
    };
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

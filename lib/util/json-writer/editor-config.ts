import { KnownProps, parseSync } from 'editorconfig';
import type { CodeFormat } from './code-format';
import { IndentationType } from './indentation-type';

export class EditorConfig {
  public static getCodeFormat(fileName: string): CodeFormat {
    const knownProps = parseSync(fileName);

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

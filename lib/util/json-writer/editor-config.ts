import { KnownProps, parse } from 'editorconfig';
import upath from 'upath';
import { GlobalConfig } from '../../config/global';
import { logger } from '../../logger';
import type { CodeFormat } from './code-format';
import type { IndentationType } from './indentation-type';

export class EditorConfig {
  public static async getCodeFormat(fileName: string): Promise<CodeFormat> {
    const localDir = GlobalConfig.get('localDir', '');
    try {
      const knownProps = await parse(upath.join(localDir, fileName));
      return {
        indentationSize: EditorConfig.getIndentationSize(knownProps),
        indentationType: EditorConfig.getIndentationType(knownProps),
      };
    } catch (err) {
      logger.warn({ err }, 'Failed to parse editor config');
      return {};
    }
  }

  private static getIndentationType(
    knownProps: KnownProps,
  ): IndentationType | undefined {
    const { indent_style: indentStyle } = knownProps;

    if (indentStyle === 'tab') {
      return 'tab';
    }

    if (indentStyle === 'space') {
      return 'space';
    }

    return undefined;
  }

  private static getIndentationSize(
    knownProps: KnownProps,
  ): number | undefined {
    const indentSize = Number(knownProps.indent_size);

    if (!Number.isNaN(indentSize) && Number.isInteger(indentSize)) {
      return indentSize;
    }

    return undefined;
  }
}

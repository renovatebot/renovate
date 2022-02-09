import type { CodeFormat } from './code-format';
import { IndentationType } from './indentation-type';

export class JSONWriter {
  private readonly indentationType: IndentationType;

  private readonly indentationSize: number;

  constructor(codeFormat: CodeFormat = {}) {
    this.indentationSize = codeFormat.indentationSize ?? 2;
    this.indentationType = codeFormat.indentationType ?? IndentationType.Space;
  }

  public write(json: unknown, newLineAtTheEnd = true): string {
    let content = JSON.stringify(json, null, this.indentation);

    if (newLineAtTheEnd) {
      content = content.concat('\n');
    }

    return content;
  }

  private get indentation(): string | number {
    if (this.indentationType === IndentationType.Tab) {
      return '\t';
    }

    return this.indentationSize;
  }
}

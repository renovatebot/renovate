import type { CodeFormat } from './code-format';
import type { IndentationType } from './indentation-type';

export class JSONWriter {
  private readonly indentationType: IndentationType;

  private readonly indentationSize: number;

  constructor(codeFormat: CodeFormat = {}) {
    this.indentationSize = codeFormat.indentationSize ?? 2;
    this.indentationType = codeFormat.indentationType ?? 'space';
  }

  public write(json: unknown, newLineAtTheEnd = true): string {
    let content = JSON.stringify(json, null, this.indentation);

    if (newLineAtTheEnd) {
      content = content.concat('\n');
    }

    return content;
  }

  private get indentation(): string | number {
    if (this.indentationType === 'tab') {
      return '\t';
    }

    return this.indentationSize;
  }
}

import { IndentationType } from './indentation-type';

export class JSONWriter {
  private readonly indentationType: IndentationType;

  private readonly indentationSize: number;

  constructor(type = IndentationType.Space, size = 2) {
    this.indentationSize = size;
    this.indentationType = type;
  }

  public write(json: unknown, newLineAtTheEnd = true): string {
    let content = JSON.stringify(json, null, this.indentaion);

    if (newLineAtTheEnd) {
      content = content.concat('\n');
    }

    return content;
  }

  private get indentaion(): string | number {
    if (this.indentationType === IndentationType.Tab) {
      return '\t';
    }

    return this.indentationSize;
  }
}

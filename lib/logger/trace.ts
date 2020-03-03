import Formatter from 'njstrace/lib/formatter';
import { Logger } from './common';

interface FormatterArgs {
  name: string;
  file: string;
  line: number;
  args: any[];
  stack: any[];
}

export class RenovateFormatter extends Formatter {
  logger: Logger;

  constructor(logger: Logger) {
    super();
    this.logger = logger;
  }

  onEntry(args: FormatterArgs): void {
    const params = args.args.map(arg => JSON.stringify(arg, null, 2)).join(',');
    this.logger.trace(`${args.name}(${params})`);
  }

  // eslint-disable-next-line class-methods-use-this
  onExit(args: FormatterArgs): void {}
}

import ignore from 'ignore';
import { regEx } from '../../../util/regex';
import type { FileOwnerRule } from '../types';

export class CodeOwnersParser {
  private currentSection: { name: string; defaultUsers: string[] };
  private internalRules: FileOwnerRule[];

  constructor() {
    this.currentSection = { name: '', defaultUsers: [] };
    this.internalRules = [];
  }

  private changeCurrentSection(line: string): void {
    const [name, ...usernames] = line.split(regEx(/\s+/));
    this.currentSection = { name, defaultUsers: usernames };
  }

  private addRule(rule: FileOwnerRule): void {
    this.internalRules.push(rule);
  }

  private extractOwnersFromLine(
    line: string,
    defaultUsernames: string[],
  ): FileOwnerRule {
    const [pattern, ...usernames] = line.split(regEx(/\s+/));
    const matchPattern = ignore().add(pattern);
    return {
      usernames: usernames.length > 0 ? usernames : defaultUsernames,
      pattern,
      score: pattern.length,
      match: (path: string) => matchPattern.ignores(path),
    };
  }

  parseLine(line: string): CodeOwnersParser {
    if (CodeOwnersParser.isSectionHeader(line)) {
      this.changeCurrentSection(line);
    } else {
      const rule = this.extractOwnersFromLine(
        line,
        this.currentSection.defaultUsers,
      );
      this.addRule(rule);
    }

    return this;
  }

  get rules(): FileOwnerRule[] {
    return this.internalRules;
  }

  private static isSectionHeader(line: string): boolean {
    return line.startsWith('[') || line.startsWith('^[');
  }
}

import { HackageDatasource } from '../../datasource/hackage';
import type { PackageDependency, PackageFileContent } from '../types';
import type { lexer as l, parser as p } from 'good-enough-parser';
import { lang } from 'good-enough-parser';

export function findExtents(indent: number, content: string, startIdx: number) {
  // Find extents of block, return index where the block stops
  let blockIdx: number = startIdx;
  let mode : 'finding-newline' | 'finding-indention' = 'finding-newline';
  while (true) {
    if (mode === 'finding-newline') {
      while (content[blockIdx++] !== "\n" && blockIdx < content.length) {}
      if (blockIdx >= content.length) {
        return content.length;
      }
      mode = 'finding-indention';
    } else {
      let thisIndent = 0;
      while (true) {
        if (content[blockIdx] === ' ') {
          thisIndent++;
          blockIdx++;
          if (blockIdx >= content.length) {
            return content.length;
          }
          continue;
        }
        if (content[blockIdx] === '\t') {
          thisIndent += 8;
          blockIdx++;
          if (blockIdx >= content.length) {
            return content.length;
          }
          continue;
        }
        mode = 'finding-newline';
        blockIdx++;
        break;
      }
      if (thisIndent < indent) {
        // go back to before the newline
        while (content[blockIdx--] !== "\n") {}
        return blockIdx+1;
      }
      mode = 'finding-newline';
    }
  }
}

export function findPrecedingIndentation(content: string, match: number) {
  // Find indention level of build-depends
  let whitespaceIdx = match-1;
  if (whitespaceIdx < 0) return 0;
  let indent = 0;
  while (true) {
    if (content[whitespaceIdx] === ' ') {
      indent += 1;
      whitespaceIdx--;
      if (whitespaceIdx < 0) {
        return 0;
      }
    } else if (content[whitespaceIdx] === '\t') {
      indent += 8;
      whitespaceIdx--;
      if (whitespaceIdx < 0) {
        return 0;
      }
    } else {
      return indent;
    }
  }
}

class DependsParser {
  readonly content: any[];
  private idx!: number;
  get currentIdx() {
    return this.idx;
  }
  constructor(content: p.Node[]) {
    this.content = content;
    this.idx = 0;
  }
  readPackageName(): string {
      if (this.content[this.idx].type !== 'symbol') {
        throw new Error(`Expected package name. At token: ${this.content[this.idx].value}, type ${this.content[this.idx].type}, token index: ${this.idx}`);
      }
      return this.content[this.idx++].value;
  }
  readNumOp(): string {
      if (this.content[this.idx].type !== 'operator') {
        throw new Error(`expected numeric operator. at token: ${this.content[this.idx].value}, type ${this.content[this.idx].type}, token index: ${this.idx}, offset: ${this.content[this.idx].offset}`);
      }
      if (['||','&&'].includes(this.content[this.idx].value)) {
        throw new Error("wrong operator, got bool, but must be numeric")
      }
      return this.content[this.idx++].value;
  }
  readVersion(): string {
      if (this.content[this.idx].type !== 'number') throw new Error('expected version');
      return this.content[this.idx++].value;
  }
  readBoolOp(): string {
      if (this.content[this.idx].type !== 'operator') {
        throw new Error(`expected operator but got ${this.content[this.idx].type} with value ${this.content[this.idx].value}`);
      }
      if (!(['||','&&'].includes(this.content[this.idx].value))) {
        throw new Error("wrong operator, got numeric, but must be bool");
      }
      return this.content[this.idx++].value;
  }
  skipOptionalComma(): boolean {
    if (this.content[this.idx].value === ',') {
      this.idx++;
      return true;
    }
    return false;
  }
}

function expandCaret(p : DependsParser) {
  const caretVersion = p.readVersion();
  const caretComponents = caretVersion.split(".");
  while (caretComponents.length > 2) caretComponents.pop();
  const intCaretComponents = caretComponents.map(x => parseInt(x, 10));
  return '>=' + caretVersion + ' <' + intCaretComponents[0] + "." + (intCaretComponents[1]+1);
}

const lexer: l.LexerConfig = {
  joinLines: null,
  comments: [{ type: 'line-comment', startsWith: '--' }],
  // issue-5846 from the cabal regression suite shows the subpackage syntax which is `package:{sub1,sub2}`
  // but since the comma also separates packages, this is seems too hard
  symbols: /[a-zA-Z][-a-zA-Z0-9:]*/,
  numbers: /[0-9\.\*]+/,
  operators: ['==', '>=', '>', '=>', '<', '<=', '^>=', '&&', '||', '-any' , '-none'],
  brackets: [
    { startsWith: '(', endsWith: ')' },
  ],
  strings: [],
};

const parser: p.ParserConfig = {
  useIndentBlocks: false,
};

const caballang = lang.createLang({ lexer, parser });

export function findDepends(content: string): null | string {
  const match = content.search(/build-depends:/i);
  if (match === -1) {
    return null;
  }

  const indent = findPrecedingIndentation(content, match);

  let ourIdx: number = match+     "build-depends:".length;

  const extent: number = findExtents(indent+1, content, ourIdx);
  content = content.slice(ourIdx,extent);
  return content;
}

export function extractPackageFile(content: string): PackageFileContent {
  const maybeContent = findDepends(content);
  if (maybeContent === null) {
    return {deps: []};
  }
  content = maybeContent;
  const parseWithWhitespaceAndStart: any[] = caballang.parse(content).children;
  const cleanTokens: p.Node[][] = [[]];
  let cleanTokenIdx = 0;
  for (const token of parseWithWhitespaceAndStart) {
    if (['_start','whitespace','comment','newline','_end'].includes(token.type)) {
      continue;
    }
    if (token.type.indexOf('tree') !== -1) {
      // We could use the distributive law of && to convert e.g.
      //   (>=2 || >=3) && <5  -- illegal semver
      // to
      //   >=2 && <5 || >=2 && <5 -- legal semver (after removing &&)
      throw new Error("can't handle parens yet");
    }
    if (token.value === ',') {
      cleanTokenIdx = cleanTokens.push([])-1;
      continue;
    }
    cleanTokens[cleanTokenIdx].push(token);
  }
  let deps: Array<PackageDependency> = [];
  for (const tokens of cleanTokens) {
    if (tokens.length === 0) continue;
    const p = new DependsParser(tokens);
    while (p.currentIdx < p.content.length) {
      const packageName: string = p.readPackageName();
      const beginPackageNameIdx: number = p.content[p.currentIdx-1].offset;
      let currentValue = "";
      while (p.currentIdx < p.content.length) {
        const numOp1: string = p.readNumOp();
        if (numOp1 === "^>=") {
          currentValue += expandCaret(p);
        } else if (numOp1 === "-any") {
          // nothing to do, this is like the star
        } else if (numOp1 === "-none") {
          currentValue += "<0";
        } else {
          if (numOp1 === '==') {
            const ver = p.readVersion();
            if (ver.indexOf('*') === -1) {
              currentValue += `=${ver}`;
            } else {
              currentValue += ver;
            }
          } else {
            // other operators are the same in semver
            currentValue += numOp1;
            currentValue += p.readVersion();
          }

          currentValue += " ";
        }
        if (p.currentIdx >= p.content.length) {
          break;
        }
        let op = p.readBoolOp();
        if (op === "||") {
          currentValue += " || ";
          continue;
        }
        if (op === "&&") {
          // The 'and' is implicit in semver strings
          continue;
        }
        throw new Error(`unexpected op: ${op}`);
      }
      currentValue = currentValue.trimEnd();
      if (currentValue === '') {
        currentValue = '*';
      }
      const prevToken = p.content[p.currentIdx-1];
      const replaceString: string = content.slice(beginPackageNameIdx,prevToken.offset+prevToken.value.length);

      const dep: PackageDependency = {
        depName: packageName,
        currentValue,
        datasource: HackageDatasource.id,
        packageName,
        versioning: 'same-major-pvp',
        replaceString,
        autoReplaceStringTemplate:
          '{{{depName}}} {{#if isSingleVersion}}^>= {{newValue}}{{else}}{{{replace " " " && " newValue}}}{{/if}}',
      };
      deps.push(dep);
    }
  }
  return { deps };
}

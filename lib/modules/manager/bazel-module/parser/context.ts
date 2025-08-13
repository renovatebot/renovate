import type {
  AllFragments,
  ArrayFragment,
  ExtensionTagFragment,
  PreparedExtensionTagFragment,
  RepoRuleFunctionCallFragment,
  ResultFragment,
  RuleFragment,
} from './fragments';
import * as fragments from './fragments';

// Represents the fields that the context must have.
export interface CtxCompatible {
  results: ResultFragment[];
  stack: AllFragments[];
}

export class CtxProcessingError extends Error {
  readonly current: AllFragments;
  readonly parent?: AllFragments;
  constructor(current: AllFragments, parent?: AllFragments) {
    const msg = `Invalid context state. current: ${current.type}, parent: ${
      parent?.type ?? 'none'
    }`;
    super(msg);
    this.name = 'CtxProcessingError';
    this.current = current;
    this.parent = parent;
  }
}

export class Ctx implements CtxCompatible {
  readonly source: string;
  results: ResultFragment[];
  stack: AllFragments[];

  // Track repo rule assignments and function mappings
  private repoRuleFunctions: Map<
    string,
    { loadPath: string; originalFunctionName: string }
  >;
  private currentRepoRuleAssignment?: {
    variableName: string;
    loadPath?: string;
    originalFunctionName?: string;
  };

  constructor(source: string) {
    this.source = source;
    this.results = [];
    this.stack = [];
    this.repoRuleFunctions = new Map();
  }

  private get safeCurrent(): AllFragments | undefined {
    return this.stack.at(-1);
  }

  private get current(): AllFragments {
    const c = this.safeCurrent;
    if (c === undefined) {
      throw new Error('Requested current, but no value.');
    }
    return c;
  }

  private get currentRule(): RuleFragment {
    const current = this.current;
    if (current.type === 'rule') {
      return current;
    }
    throw new Error('Requested current rule, but does not exist.');
  }

  private get currentExtensionTag(): ExtensionTagFragment {
    const current = this.current;
    if (current.type === 'extensionTag') {
      return current;
    }
    throw new Error('Requested current extension tag, but does not exist.');
  }

  private get currentRepoRuleFunctionCall(): RepoRuleFunctionCallFragment {
    const current = this.current;
    if (current.type === 'repoRuleFunctionCall') {
      return current;
    }
    throw new Error(
      'Requested current repo rule function call, but does not exist.',
    );
  }

  private get currentArray(): ArrayFragment {
    const current = this.current;
    if (current.type === 'array') {
      return current;
    }
    throw new Error('Requested current array, but does not exist.');
  }

  private popPreparedExtensionTag(): PreparedExtensionTagFragment {
    const c = this.stack.pop();
    if (c === undefined) {
      throw new Error('Requested current, but no value.');
    }
    if (c.type === 'preparedExtensionTag') {
      return c;
    }
    throw new Error(
      'Requested current prepared extension tag, but does not exist.',
    );
  }

  private popStack(): boolean {
    const current = this.stack.pop();
    if (!current) {
      return false;
    }
    if (!current.isComplete) {
      this.stack.push(current);
      return false;
    }
    const parent = this.safeCurrent;

    if (parent) {
      if (parent.type === 'attribute' && fragments.isValue(current)) {
        parent.value = current;
        parent.isComplete = true;
        return true;
      }
      if (parent.type === 'array' && fragments.isPrimitive(current)) {
        parent.items.push(current);
        return true;
      }
      if (
        (parent.type === 'rule' ||
          parent.type === 'extensionTag' ||
          parent.type === 'repoRuleFunctionCall') &&
        current.type === 'attribute' &&
        current.value !== undefined
      ) {
        parent.children[current.name] = current.value;
        return true;
      }
    } else if (
      current.type === 'rule' ||
      current.type === 'extensionTag' ||
      current.type === 'repoRuleFunctionCall'
    ) {
      this.results.push(current);
      return true;
    }

    throw new CtxProcessingError(current, parent);
  }

  private processStack(): Ctx {
    while (this.popStack()) {
      // Nothing to do
    }
    return this;
  }

  addString(value: string): Ctx {
    this.stack.push(fragments.string(value));
    return this.processStack();
  }

  addBoolean(value: string | boolean): Ctx {
    this.stack.push(fragments.boolean(value));
    return this.processStack();
  }

  startRule(name: string): Ctx {
    const rule = fragments.rule(name);
    this.stack.push(rule);
    return this;
  }

  endRule(): Ctx {
    const rule = this.currentRule;
    rule.isComplete = true;
    return this.processStack();
  }

  prepareExtensionTag(
    extension: string,
    rawExtension: string,
    offset: number,
  ): Ctx {
    const preppedTag = fragments.preparedExtensionTag(
      extension,
      rawExtension,
      offset,
    );
    this.stack.push(preppedTag);
    return this;
  }

  startExtensionTag(tag: string): Ctx {
    const { extension, rawExtension, offset } = this.popPreparedExtensionTag();

    const extensionTag = fragments.extensionTag(
      extension,
      rawExtension,
      tag,
      offset,
    );
    this.stack.push(extensionTag);
    return this;
  }

  endExtensionTag(offset: number): Ctx {
    const tag = this.currentExtensionTag;
    tag.isComplete = true;
    tag.rawString = this.source.slice(tag.offset, offset);
    return this.processStack();
  }

  startAttribute(name: string): Ctx {
    this.stack.push(fragments.attribute(name));
    return this.processStack();
  }

  startArray(): Ctx {
    this.stack.push(fragments.array());
    return this.processStack();
  }

  endArray(): Ctx {
    const array = this.currentArray;
    array.isComplete = true;
    return this.processStack();
  }

  // Repo rule assignment methods
  startRepoRuleAssignment(variableName: string): Ctx {
    this.currentRepoRuleAssignment = { variableName };
    return this;
  }

  addRepoRuleLoadPath(loadPath: string): Ctx {
    if (this.currentRepoRuleAssignment) {
      this.currentRepoRuleAssignment.loadPath = loadPath;
    }
    return this;
  }

  addRepoRuleFunctionName(originalFunctionName: string): Ctx {
    if (this.currentRepoRuleAssignment) {
      this.currentRepoRuleAssignment.originalFunctionName =
        originalFunctionName;
    }
    return this;
  }

  endRepoRuleAssignment(): Ctx {
    if (
      this.currentRepoRuleAssignment?.loadPath &&
      this.currentRepoRuleAssignment?.originalFunctionName
    ) {
      // Only track rules_img repo rules - support both load paths used in tests
      const rulesImgLoadPaths = [
        '@rules_img//img:pull.bzl',
        '@rules_img//img/private/repository_rules:pull.bzl',
      ];

      if (rulesImgLoadPaths.includes(this.currentRepoRuleAssignment.loadPath)) {
        this.repoRuleFunctions.set(
          this.currentRepoRuleAssignment.variableName,
          {
            loadPath: this.currentRepoRuleAssignment.loadPath,
            originalFunctionName:
              this.currentRepoRuleAssignment.originalFunctionName,
          },
        );
      }
    }
    this.currentRepoRuleAssignment = undefined;
    return this;
  }

  // Dynamic function call methods
  isRulesImgFunction(functionName: string): boolean {
    return this.repoRuleFunctions.has(functionName);
  }

  startDynamicFunctionCall(functionName: string, offset: number): Ctx {
    const repoRuleInfo = this.repoRuleFunctions.get(functionName);
    if (!repoRuleInfo) {
      throw new Error(`Function ${functionName} not found in repo rules`);
    }

    const functionCall = fragments.repoRuleFunctionCall(
      functionName,
      repoRuleInfo.loadPath,
      repoRuleInfo.originalFunctionName,
      offset,
    );
    this.stack.push(functionCall);
    return this;
  }

  endDynamicFunctionCall(offset: number): Ctx {
    const functionCall = this.currentRepoRuleFunctionCall;
    functionCall.isComplete = true;
    functionCall.rawString = this.source.slice(functionCall.offset, offset);
    return this.processStack();
  }
}

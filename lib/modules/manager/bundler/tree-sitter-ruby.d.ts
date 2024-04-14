declare module 'tree-sitter-ruby' {
  import type { SyntaxNode } from 'tree-sitter';

  export interface IdentifierNode extends SyntaxNode {
    type: 'identifier';
  }

  export interface ArgumentListNode extends SyntaxNode {
    type: 'argument_list';
  }

  export interface CallNode extends SyntaxNode {
    type: 'call';
    methodNode: SyntaxNode;
    argumentsNode?: SyntaxNode;
  }
}

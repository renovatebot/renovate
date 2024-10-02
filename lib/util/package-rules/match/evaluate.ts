import { ASTNode, BinaryOpNode, ComparisonNode } from './types';

export function evaluate(node: ASTNode, data: unknown): boolean {
  if (node.type === 'BinaryOp') {
    const opNode = node as BinaryOpNode;
    if (opNode.operator === 'AND') {
      const leftResult = evaluate(opNode.left, data);
      if (!leftResult) {
        return false; // Short-circuit
      }
      return evaluate(opNode.right, data);
    } else if (opNode.operator === 'OR') {
      const leftResult = evaluate(opNode.left, data);
      if (leftResult) {
        return true; // Short-circuit
      }
      return evaluate(opNode.right, data);
    }
  } else if (node.type === 'Comparison') {
    const compNode = node as ComparisonNode;
    const dataValue = (data as any)[compNode.key];
    if (dataValue === undefined || dataValue === null) {
      return false;
    }

    // Ensure type consistency for comparison
    if (typeof dataValue !== typeof compNode.value) {
      return false;
    }

    if (compNode.operator === 'EQUALS') {
      return dataValue === compNode.value;
    } else if (compNode.operator === 'NOT_EQUALS') {
      return dataValue !== compNode.value;
    }
  }
  return false;
}

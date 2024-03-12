import is from '@sindresorhus/is';
import {
  ArgumentNode,
  DefinitionNode,
  DocumentNode,
  FieldNode,
  Kind,
  OperationDefinitionNode,
  SelectionNode,
  SelectionSetNode,
  TypeNode,
  ValueNode,
  VariableDefinitionNode,
  parse,
} from 'graphql/language';

function isOperationDefinitionNode(
  def: DefinitionNode,
): def is OperationDefinitionNode {
  return def.kind === Kind.OPERATION_DEFINITION;
}

function isFieldNode(sel: SelectionNode): sel is FieldNode {
  return sel.kind === Kind.FIELD;
}

interface Arguments {
  [key: string]:
    | string
    | boolean
    | null
    | Arguments
    | (string | boolean | null | Arguments)[];
}

type Variables = Record<string, string>;

interface SelectionSet {
  __vars?: Variables;
  __args?: Arguments;
  [key: string]: undefined | null | SelectionSet | Arguments;
}

interface GraphqlSnapshot {
  query?: SelectionSet;
  mutation?: SelectionSet;
  subscription?: SelectionSet;
  variables?: Record<string, string>;
}

function getArguments(key: string, val: ValueNode): Arguments {
  const result: Arguments = {};
  const kind = val.kind;
  if (
    val.kind === Kind.INT ||
    val.kind === Kind.FLOAT ||
    val.kind === Kind.STRING ||
    val.kind === Kind.BOOLEAN ||
    val.kind === Kind.ENUM
  ) {
    result[key] = val.value;
  } else if (val.kind === Kind.OBJECT) {
    let childResult: Arguments = {};
    val.fields.forEach((fieldNode) => {
      const childKey = fieldNode.name.value;
      const childVal = getArguments(childKey, fieldNode.value);
      childResult = { ...childResult, ...childVal };
    });
    result[key] = childResult;
  } else if (val.kind === Kind.LIST) {
    const results: Arguments[] = [];
    val.values.forEach((fieldNode) => {
      results.push(getArguments(key, fieldNode));
    });
    result[key] = results.map(({ [key]: x }) => x).flat();
  } else if (val.kind === Kind.NULL) {
    result[key] = null;
  } else if (val.kind === Kind.VARIABLE) {
    result[key] = `$${val.name.value}`;
  } else {
    result[key] = `<<${kind}>>`;
  }
  return result;
}

function simplifyArguments(
  argNodes?: ReadonlyArray<ArgumentNode>,
): Arguments | null {
  if (argNodes) {
    let result: Arguments = {};
    argNodes.forEach((argNode) => {
      const name = argNode.name.value;
      const valNode = argNode.value;
      result = {
        ...result,
        ...getArguments(name, valNode),
      };
    });
    return result;
  }

  return null;
}

function simplifySelectionSet(
  selectionSet: SelectionSetNode,
  parentArgs: Arguments | null,
  parentVars: Variables | null,
): SelectionSet {
  const result: SelectionSet = {};

  selectionSet.selections.forEach((selectionNode) => {
    if (isFieldNode(selectionNode)) {
      const name = selectionNode.name.value;
      const args = simplifyArguments(selectionNode.arguments);
      const childSelectionSet = selectionNode.selectionSet;
      if (parentVars && !is.emptyObject(parentVars)) {
        result.__vars = parentVars;
      }
      if (parentArgs && !is.emptyObject(parentArgs)) {
        result.__args = parentArgs;
      }
      result[name] = childSelectionSet
        ? simplifySelectionSet(childSelectionSet, args, null)
        : null;
    }
  });

  return result;
}

function getTypeName(typeNode: TypeNode): string {
  const kind = typeNode.kind;

  if (typeNode.kind === Kind.NAMED_TYPE) {
    return typeNode.name.value;
  }

  const childTypeNode = typeNode.type;
  const childTypeName = getTypeName(childTypeNode);

  if (kind === Kind.LIST_TYPE) {
    return `[${childTypeName}]`;
  }

  if (kind === Kind.NON_NULL_TYPE) {
    return `${childTypeName}!`;
  }

  return `<<${kind}>>`;
}

function simplifyVariableDefinitions(
  varNodes: ReadonlyArray<VariableDefinitionNode> | null,
): Variables {
  const result: Variables = {};
  if (varNodes) {
    varNodes.forEach((varNode) => {
      const key = `$${varNode.variable.name.value}`;
      const typeNode = varNode.type;
      const typeName = getTypeName(typeNode);
      result[key] = typeName;
    });
  }
  return result;
}

function simplifyGraphqlTree(tree: DocumentNode): GraphqlSnapshot {
  const result: GraphqlSnapshot = {};

  const { definitions } = tree;
  definitions.forEach((def) => {
    if (isOperationDefinitionNode(def)) {
      const { operation, selectionSet, variableDefinitions = null } = def;
      const vars = simplifyVariableDefinitions(variableDefinitions);
      result[operation] = simplifySelectionSet(selectionSet, null, vars);
    }
  });

  return result;
}

export interface GraphqlSnapshotInput {
  query: string;
  variables: Record<string, string>;
}

export function makeGraphqlSnapshot(
  requestBody: GraphqlSnapshotInput,
): GraphqlSnapshot | null {
  try {
    const { query: queryStr, variables } = requestBody;
    if (!queryStr) {
      return null;
    }
    const queryRawTree = parse(queryStr, { noLocation: true });
    const queryTree = simplifyGraphqlTree(queryRawTree);
    if (variables) {
      return { variables, ...queryTree };
    }
    return queryTree;
  } catch (ex) {
    return null;
  }
}

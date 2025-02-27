import is from '@sindresorhus/is';
import { type AST, getStaticTOMLValue, parseTOML } from 'toml-eslint-parser';

export function parse(input: string): unknown {
  const ast = parseTOML(input);
  return getStaticTOMLValue(ast);
}

function isKey(
  ast: AST.TOMLKeyValue,
  path: (string | number)[],
): AST.TOMLValue | undefined {
  if (ast.key.keys.length > path.length) {
    return;
  }

  if (
    ast.key.keys.every((key, index) => {
      return (
        (key.type === 'TOMLBare' && key.name === path[index]) ||
        (key.type === 'TOMLQuoted' && key.value === path[index])
      );
    })
  ) {
    return getSingleValue(ast.value, path.slice(ast.key.keys.length));
  }

  return;
}

/**
 * get a AST node presenting a single value (string/int/float)
 * return undefined if the path point to a compose value (object/array)
 */
export function getSingleValue(
  ast: AST.TOMLNode,
  path: (string | number)[],
): AST.TOMLValue | undefined {
  if (path.length === 0) {
    if (ast.type !== 'TOMLValue') {
      return;
    }
    return ast;
  }

  if (ast.type === 'Program') {
    return getSingleValue(ast.body[0], path);
  }

  if (ast.type === 'TOMLTopLevelTable') {
    for (const body of ast.body) {
      if (body.type === 'TOMLTable') {
        // body.resolvedKey may be ['key'], ['key', 'subkey'] for object and [packages, number] for array
        if (body.resolvedKey.length < path.length) {
          if (body.resolvedKey.every((item, index) => item === path[index])) {
            const restKey = path.slice(body.resolvedKey.length);
            for (const item of body.body) {
              const o = isKey(item, restKey);
              if (o) {
                return o;
              }
            }
          }
        }
      } else if (body.type === 'TOMLKeyValue') {
        const o = isKey(body, path);
        if (o) {
          return o;
        }
      }
    }

    return;
  }

  if (ast.type === 'TOMLTable' || ast.type === 'TOMLInlineTable') {
    for (const item of ast.body) {
      const o = isKey(item, path);
      if (o) {
        return o;
      }
    }

    return;
  }

  if (ast.type === 'TOMLArray') {
    if (is.number(path[0])) {
      return getSingleValue(ast.elements[path[0]], path.slice(1));
    }
  }
}

/**
 * Replace a string node at given object path in TOML, preserve toml whitespace style.
 */
export function replaceString(
  toml: string,
  path: (string | number)[],
  updater: (currentValue: string) => string,
): string {
  const node = getSingleValue(parseTOML(toml), path);

  if (!node) {
    return toml;
  }

  if (node.kind !== 'string') {
    return toml;
  }

  const newValue = updater(node.value);

  let newStr: string;

  if (node.style === 'basic') {
    newStr = JSON.stringify(newValue);
  } else if (newValue.includes("'")) {
    newStr = JSON.stringify(newValue);
  } else {
    newStr = "'" + newValue + "'";
  }

  return toml.slice(0, node.range[0]) + newStr + toml.slice(node.range[1]);
}

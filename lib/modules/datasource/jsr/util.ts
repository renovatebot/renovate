// Ported from jsr:
// https://github.com/jsr-io/jsr/blob/b8d753f4ed96f032bc494e8809065cfe8df5c641/frontend/utils/ids.ts
// Copyright 2024 the JSR authors. All rights reserved. MIT license.

import is from '@sindresorhus/is';
import { regEx } from '../../../util/regex';

export function extractJsrPackageName(packageName: string): {
  scope: string;
  name: string;
} | null {
  // trim first @
  const validatePackageName = packageName.replace(regEx(/^@/), '');
  const parts = validatePackageName.split('/');
  if (parts.length !== 2) {
    return null;
  }
  const [scope, name] = parts;
  if (is.null(parseJsrScopeName(scope))) {
    return null;
  }
  if (is.null(parseJsrPackageName(name))) {
    return null;
  }
  return { scope, name };
}

function parseJsrScopeName(name: string): string | null {
  if (name.length > 100) {
    return null;
  }
  if (name.length < 3) {
    return null;
  }
  if (!regEx(/^[a-zA-Z0-9-_]+$/).test(name)) {
    return null;
  }
  return name;
}

function parseJsrPackageName(name: string): string | null {
  if (name.startsWith('@')) {
    return null;
  }
  if (name.length > 58) {
    return null;
  }
  if (!regEx(/^[a-z0-9-]+$/).test(name)) {
    return null;
  }
  if (name.startsWith('-')) {
    return null;
  }
  return name;
}

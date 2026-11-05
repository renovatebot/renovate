import { isUndefined } from '@sindresorhus/is';
import type { HTMLElement, Options } from 'node-html-parser';
import { parse as _parse } from 'node-html-parser';

export type { HTMLElement, Options };

export function parse(html: string, config?: Partial<Options>): HTMLElement {
  if (!isUndefined(config)) {
    return _parse(html, config);
  }

  return _parse(html);
}

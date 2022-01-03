import type { HTMLElement, Options } from 'node-html-parser';
import _parse from 'node-html-parser';

export type { HTMLElement, Options };

export function parse(html: string, config?: Partial<Options>): HTMLElement {
  if (typeof config !== 'undefined') {
    return _parse(html, config);
  }

  return _parse(html);
}

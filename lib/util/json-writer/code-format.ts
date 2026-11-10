import type { IndentationType } from './indentation-type.ts';

export interface CodeFormat {
  indentationSize?: number;
  indentationType?: IndentationType;
  maxLineLength?: number | 'off';
}

import type { Rule as MooRule } from 'moo';
import { escapeRegExp as esc } from '../../regex';
import { CommentOption } from './types';

export function commentRule(opts: CommentOption): MooRule {
  let { start, finish } = opts;

  const lineBreaks = !!finish;
  const anySeq = lineBreaks ? '[^]*?' : '.*?';
  start = esc(start);
  finish = finish ? esc(finish) : '$';
  const match = new RegExp(`${start}${anySeq}${finish}`);

  return { match, lineBreaks };
}

export interface SortableOption {
  start: string;
}

export interface CommentOption extends SortableOption {
  finish?: string;
}

export interface StringOption extends SortableOption {
  finish?: string;
}

export interface TemplateOption extends StringOption {
  templates: {
    start: string;
    finish?: string;
  }[];
}

export type OneOrMany<T = unknown> = T | T[];

export interface TokenizerOptions {
  comments?: OneOrMany<CommentOption>;
  symbols?: RegExp | null;
  strings?: OneOrMany<StringOption>;
  templates?: OneOrMany<TemplateOption>;
}

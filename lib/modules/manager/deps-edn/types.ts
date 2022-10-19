export type UnionToIntersection<T> = (
  T extends any ? (x: T) => any : never
) extends (x: infer R) => any
  ? R
  : never;
export type TokenTypes<T> = keyof UnionToIntersection<T[keyof T]>;

export type ParsedEdnPrimitive = string | null;
export type ParsedEdnArray = ParsedEdnData[];
export type ParsedEdnRecord = { [k: string]: ParsedEdnData };
export type ParsedEdnData =
  | ParsedEdnPrimitive
  | ParsedEdnRecord
  | ParsedEdnArray;

export type ParserState =
  | {
      type: 'root';
      data: ParsedEdnData;
    }
  | {
      type: 'array';
      startIndex: number;
      data: ParsedEdnArray;
    }
  | {
      type: 'record';
      skipKey: boolean;
      currentKey: string | null;
      startIndex: number;
      data: ParsedEdnRecord;
    };

export interface EdnMetadata {
  replaceString: string;
}

export type ParsedEdnMetadata = WeakMap<
  ParsedEdnRecord | ParsedEdnArray,
  EdnMetadata
>;

export interface ParsedEdnResult {
  data: ParsedEdnRecord;
  metadata: ParsedEdnMetadata;
}

export type UnionToIntersection<T> = (
  T extends unknown ? (x: T) => void : never
) extends (x: infer R) => void
  ? R
  : never;
export type TokenTypes<T> = keyof UnionToIntersection<T[keyof T]>;

export type ParsedEdnPrimitive = string | null;
export type ParsedEdnArray = ParsedEdnData[];
// Interface not possible due to circular reference
// oxlint-disable-next-line typescript/consistent-type-definitions
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

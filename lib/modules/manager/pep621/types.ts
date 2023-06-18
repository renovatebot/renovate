export interface Pep508ParseResult {
  packageName: string;
  currentValue?: string;
  extras?: string[];
  marker?: string;
}

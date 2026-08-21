export interface Pep508ParseResult {
  packageName: string;
  currentValue?: string;
  extras?: string[];
  marker?: string;
}

export interface Pep621ManagerData {
  depGroup?: string;
}

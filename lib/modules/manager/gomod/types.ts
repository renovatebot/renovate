export interface GoModManagerData {
  lineNumber?: number;
  multiLine?: boolean;
}

export interface ExtraDep {
  depName: string;
  currentValue: string;
  newValue: string;
}

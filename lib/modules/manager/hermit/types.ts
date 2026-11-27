export interface HermitListItem {
  Name: string;
  Version: string;
  Channel: string;
}

export interface ReadContentResult {
  isSymlink?: boolean;
  contents: string;
  isExecutable?: boolean;
}

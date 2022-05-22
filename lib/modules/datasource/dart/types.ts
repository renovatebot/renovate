export interface DartResult {
  versions?: {
    version: string;
    published?: string;
    retracted?: boolean;
  }[];
  latest?: {
    pubspec?: { homepage?: string; repository?: string };
  };
}

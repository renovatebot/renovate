export interface DartResult {
  versions?: {
    version: string;
    published?: string;
  }[];
  latest?: {
    pubspec?: { homepage?: string; repository?: string };
  };
}

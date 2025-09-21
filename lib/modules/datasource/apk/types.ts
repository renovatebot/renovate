export interface ApkPackage {
  name: string;
  version: string;
  description?: string;
  url?: string;
  size?: number;
  buildDate?: number;
  origin?: string;
  arch?: string;
  license?: string;
  depends?: string[];
  provides?: string[];
  conflicts?: string[];
  replaces?: string[];
}

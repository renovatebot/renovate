export type JsDelivrPackageType = 'npm' | 'gh';

export interface JsDelivrParsedPackageName {
  type: JsDelivrPackageType;
  package: string;
  asset: string;
}

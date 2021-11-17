export interface Migration {
  readonly propertyName: string;
  run(): void;
}

import { regEx } from '../../../util/regex';

export const googleRegex = regEx(
  /(((eu|us|asia)\.)?gcr\.io|[a-z0-9-]+-docker\.pkg\.dev)/,
);

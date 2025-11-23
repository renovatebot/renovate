import { regEx } from '../../../util/regex';

export const denoLandRegex = regEx(
  /(https:\/\/deno.land\/)(?<rawPackageName>[^@\s]+)(?:@(?<currentValue>[^/\s]+))?(?<filePath>\/[^\s]*)?/,
);
// "deno task" could refer to another task e.g. "deno task npm:build"
export const depValueRegex = regEx(
  /(?:deno task\s+\w+:[^\s]+)|(?<datasource>\w+):\/?(?<depName>@?[\w-]+(?:\/[\w-]+)?)(?:@(?<currentValue>[^\s/]+))?\/?/,
);

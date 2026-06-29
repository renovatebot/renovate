type StrObjNull = string | object | null;

export function buildTestJwt(
  header: StrObjNull,
  payload: StrObjNull,
  sig: StrObjNull,
): string {
  const encode = (segment: StrObjNull): string => {
    return Buffer.from(JSON.stringify(segment)).toString('base64url');
  };
  return `${encode(header)}.${encode(payload)}.${encode(sig)}`;
}

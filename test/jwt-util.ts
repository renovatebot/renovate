type StrObjNull = string | object | null;

function encodeJwtPart(segment: StrObjNull): string {
  return Buffer.from(JSON.stringify(segment)).toString('base64url');
}

export function buildTestJwt(
  header: StrObjNull,
  payload: StrObjNull,
  sig: StrObjNull,
): string {
  return `${encodeJwtPart(header)}.${encodeJwtPart(payload)}.${encodeJwtPart(sig)}`;
}

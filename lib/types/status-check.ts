export enum StatusCheck {
  stabilityDays = 'renovate/stability-days',
  unpublishSafe = 'renovate/unpublish-safe',
}

export function isStatusCheck(status: string): status is StatusCheck {
  return Object.values(StatusCheck).includes(status as StatusCheck);
}

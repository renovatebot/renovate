# GitLab merge_after Implementation

This document describes the implementation of GitLab's "prevent merge before a specific date" functionality using the `automergeSchedule` configuration option.

## Overview

When `automergeSchedule` is configured and Renovate determines that the current time is outside the allowed merge schedule, it will use GitLab's `merge_after` parameter to delay the merge until the next allowed time slot.

## Implementation Details

### Core Components

1. **PlatformPrOptions Interface** (`lib/modules/platform/types.ts`)
   - Added `automergeSchedule?: string[]` field
   - Added `timezone?: string` field

2. **Platform Options Builder** (`lib/workers/repository/update/pr/index.ts`)
   - Extended `getPlatformPrOptions()` to pass schedule configuration to platforms

3. **GitLab Platform Implementation** (`lib/modules/platform/gitlab/index.ts`)
   - Modified `tryPrAutomerge()` function to:
     - Check if current time is within automergeSchedule
     - Calculate next allowed merge time when outside schedule
     - Set `merge_after` parameter in GitLab API call

### How It Works

1. When a PR is created with `usePlatformAutomerge: true` and `automergeSchedule` configured:
   - Renovate checks if current time falls within any of the configured schedules
   - If **inside schedule**: Normal automerge behavior (immediate merge when pipeline succeeds)
   - If **outside schedule**: Calculate next allowed merge time and set `merge_after` parameter

2. GitLab's API will then:
   - Hold the merge request in "scheduled to merge" status
   - Automatically execute the merge at the specified `merge_after` time
   - Only merge if all other conditions are met (pipeline success, approvals, etc.)

### Configuration Examples

```json
{
  "automerge": true,
  "automergeType": "pr",
  "platformAutomerge": true,
  "automergeSchedule": [
    "after 10pm and before 5am every weekday",
    "after 10pm on friday",
    "before 5am on monday"
  ],
  "timezone": "Europe/Berlin"
}
```

This configuration would:
- Allow immediate merges during weekday nights (10pm-5am) and weekends
- Delay merges during business hours until the next allowed window
- Use Berlin timezone for schedule calculations

### Supported Schedule Formats

The implementation supports both schedule formats already used in Renovate:

1. **Later.js text syntax**:
   - `"after 10pm and before 5am every weekday"`
   - `"after 10pm on friday"`
   - `"before 5am on monday"`

2. **Cron syntax**:
   - `"0 2 * * 1-5"` (2 AM on weekdays)
   - `"0 22 * * 5"` (10 PM on Friday)

### API Integration

The GitLab merge request API call is enhanced to include the `merge_after` parameter:

```javascript
// Without schedule or when inside schedule
{
  "should_remove_source_branch": true,
  "merge_when_pipeline_succeeds": true
}

// When outside schedule
{
  "should_remove_source_branch": true,
  "merge_when_pipeline_succeeds": true,
  "merge_after": "2025-08-04T22:00:00.000Z"
}
```

### Error Handling

- Invalid schedule strings are logged as warnings and ignored
- If no valid next schedule time can be calculated, normal automerge behavior is used
- Timezone parsing errors fall back to system timezone

### Compatibility

- Only affects GitLab platform when both `platformAutomerge` and `automergeSchedule` are configured
- No changes to existing behavior when `automergeSchedule` is not configured
- Compatible with all existing automerge strategies and settings

## Testing

The implementation can be tested by:

1. Configuring `automergeSchedule` with a future time window
2. Creating a PR during a time outside the schedule
3. Verifying that GitLab shows "scheduled to merge" status with the correct time
4. Confirming the merge executes automatically at the scheduled time

## References

- GitLab API Documentation: [Merge Requests API](https://docs.gitlab.com/ee/api/merge_requests.html)
- Issue: [#37028 - GitLab: prevent merge before a specific date](https://github.com/renovatebot/renovate/issues/37028)

# Log Errors

Renovate's "fatal" log errors are strongly typed so that:

- The `errCode` field is constant over time, even if the `msg` field may be tweaked for understandability
- Every fatal error/message you might see in logs is documented below

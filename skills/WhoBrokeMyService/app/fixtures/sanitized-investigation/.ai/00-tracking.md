# Investigation Tracking

## Current hypothesis

The service used a stale tenant cache after a configuration update.

## Open loops

- Confirm cache invalidation reaches every worker.
- Compare successful and failing tenant requests.

## Open questions

- Was the update applied while workers were restarting?

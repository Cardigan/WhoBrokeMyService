# Hypotheses

The following POCs are independent explanations to test.

## POC 1: Cache invalidation missed the tenant

Expected evidence: the stale worker never received the invalidation message.

## POC 2: Configuration update reached only part of the fleet

Expected evidence: worker configuration versions differ after the rollout.

## POC 3: Request routing pinned traffic to an old worker

Expected evidence: failed requests share a worker affinity value.

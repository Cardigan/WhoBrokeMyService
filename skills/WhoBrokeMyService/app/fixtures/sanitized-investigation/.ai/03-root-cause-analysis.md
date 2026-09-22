# Root Cause Analysis

## Root cause

A test-only invalidation publisher omitted one tenant partition.

## Evidence

The omitted partition matched the stale worker's request logs.

## Failure chain

Update event -> omitted partition -> stale cache -> outdated response.

## Proposed fix

Publish invalidations for all partitions and add a partition-count assertion.

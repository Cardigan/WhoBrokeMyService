# Initial Findings

## Problem statement

Requests for one sample tenant returned an outdated setting after an update.

## Environment

The issue was reproduced in a local, sanitized development environment.

## Timeline

The first failure occurred after a configuration rollout.

## Observations

Healthy workers returned the new value; one worker returned the old value.

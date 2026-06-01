# Delivery Driver

## Public Delivery Slots

`/api/delivery/slots` accepts public `from`/`to` ranges only from today through today plus 60 days. Out-of-range requests return `400`.

Capacity counts only orders with `deliveryCapacityReservedAt` set. Stripe orders do not consume capacity until the paid webhook reserves it.

## Driver Links

Driver links are bearer-style tokens. Do not paste them into logs, tickets, screenshots, or public docs.

Driver route throttles:

- `optimize`: 6 requests per 10 minutes per token hash.
- `location`: 120 requests per minute per token hash.

## Finish Rules

A driver run can be finished only when:

- The run is `IN_PROGRESS`.
- All stops are no longer `PENDING`.

Invalid states return `409`.

## GPS Rules

Driver GPS samples are rejected when:

- Recorded more than 5 minutes in the past.
- Recorded more than 60 seconds in the future.
- Accuracy is worse than 100 meters.
- Timestamp is not monotonic for the run.
- Reported or implied speed is over 150 km/h.

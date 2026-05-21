# Job Engine

Volum treats copy, move, delete, upload, extract, archive, and checksum operations as persistent jobs.

## Statuses

- `queued`
- `running`
- `paused`
- `completed`
- `failed`
- `cancelled`
- `needs_attention`

## Copy Safety

Files are copied to `.volum-tmp/<name>.partial` first. After the copy completes, the worker verifies the byte count and then atomically renames the partial file to the final path.

The worker must never overwrite an existing destination unless a conflict policy explicitly allows it.

## Move Safety

Move is implemented as copy, verify, then delete source. The source is not removed until destination verification succeeds.

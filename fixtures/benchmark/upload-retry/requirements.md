# Upload Retry Requirements

## Acceptance criteria
- REQ-1: Selecting a .txt fixture enables upload.
- REQ-2: Unsupported file types show a validation error.
- REQ-3: The first upload attempt deterministically fails and exposes Retry.
- REQ-4: Retrying succeeds and shows Uploaded.
- REQ-5: Clearing resets the local upload state.

## Capabilities
- CAP-1: Local file-upload-like flow.
- CAP-2: Error state and retry.
- CAP-3: API-style status update.

## Constraints
- CON-1: Only .txt files are accepted.

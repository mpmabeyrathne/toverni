# Checkout Form Requirements

## Acceptance criteria
- REQ-1: Checkout requires a customer name before continuing.
- REQ-2: A valid shipping address advances to the payment step.
- REQ-3: Invalid card input shows a validation error.
- REQ-4: A valid local test card opens an order confirmation dialog.
- REQ-5: Confirming the dialog completes the order without external payment dependencies.

## Capabilities
- CAP-1: Multi-step checkout.
- CAP-2: Local payment-like validation.
- CAP-3: Modal order confirmation.

## Constraints
- CON-1: Empty required fields cannot advance.
- CON-2: Card values other than 4242424242424242 are rejected.

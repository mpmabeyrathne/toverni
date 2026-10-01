# Authentication and RBAC Requirements

## Acceptance criteria
- REQ-1: A valid user can sign in and a signed-in session remains active while navigating inside the app.
- REQ-2: An invalid password shows an authentication error and does not create a session.
- REQ-3: Admin users can open the admin panel.
- REQ-4: Standard users are prevented from opening the admin panel.
- REQ-5: Signing out clears the session and returns to the sign-in view.

## Capabilities
- CAP-1: Sign in.
- CAP-2: Navigate between dashboard and profile without losing session state.
- CAP-3: Role-based admin access.
- CAP-4: Sign out.

## Constraints
- CON-1: Invalid credentials must not authenticate.
- CON-2: Standard users must not gain admin access.

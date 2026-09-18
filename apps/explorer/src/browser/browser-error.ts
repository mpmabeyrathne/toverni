export type BrowserOperation =
  | 'launch'
  | 'create-session'
  | 'navigate'
  | 'click'
  | 'fill'
  | 'select'
  | 'submit'
  | 'back'
  | 'forward'
  | 'reload'
  | 'wait'
  | 'close';

export type BrowserErrorCode =
  | 'BROWSER_LAUNCH_FAILED'
  | 'SESSION_CREATION_FAILED'
  | 'NAVIGATION_FAILED'
  | 'ACTION_FAILED'
  | 'BROWSER_NOT_STARTED'
  | 'SESSION_CLOSED'
  | 'BROWSER_CLOSE_FAILED';

interface BrowserControllerErrorOptions {
  code: BrowserErrorCode;
  operation: BrowserOperation;
  message: string;
  cause?: unknown;
}

export class BrowserControllerError extends Error {
  readonly code: BrowserErrorCode;
  readonly operation: BrowserOperation;
  readonly originalMessage?: string;

  constructor(options: BrowserControllerErrorOptions) {
    super(options.message);

    this.name = 'BrowserControllerError';
    this.code = options.code;
    this.operation = options.operation;

    if (options.cause instanceof Error) {
      this.originalMessage = options.cause.message;
    }
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      operation: this.operation,
      message: this.message,
      originalMessage: this.originalMessage,
    };
  }
}
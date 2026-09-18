import {
    chromium,
    type Browser,
    type BrowserContext,
    type Locator,
    type Page,
  } from 'playwright';
  
  import type {
    PageObservation,
  } from '../contracts/page-observation.js';
  
  import {
    PlaywrightPageObserver,
  } from '../observation/playwright-page-observer.js';
  
  import type {
    BrowserController,
    BrowserControllerOptions,
  } from './browser-controller.js';
  
  import {
    BrowserControllerError,
  } from './browser-error.js';
  
  import type {
    BrowserSession,
  } from './browser-session.js';
  
  import type {
    BrowserTarget,
  } from './browser-target.js';
  
  const DEFAULT_TIMEOUT_MS = 15_000;
  
  type PlaywrightRole =
    Parameters<Page['getByRole']>[0];
  
  export class PlaywrightBrowserController
    implements BrowserController
  {
    private browser: Browser | null = null;
  
    private readonly headless: boolean;
  
    private readonly timeoutMs: number;
  
    private readonly artifactsDirectory:
      | string
      | undefined;
  
    constructor(
      options: BrowserControllerOptions = {},
    ) {
      this.headless =
        options.headless ?? true;
  
      this.timeoutMs =
        options.timeoutMs ??
        DEFAULT_TIMEOUT_MS;
  
      this.artifactsDirectory =
        options.artifactsDirectory;
    }
  
    async start(): Promise<void> {
      if (this.browser) {
        return;
      }
  
      try {
        this.browser = await chromium.launch({
          headless: this.headless,
        });
      } catch (error: unknown) {
        throw new BrowserControllerError({
          code: 'BROWSER_LAUNCH_FAILED',
          operation: 'launch',
          message:
            'Failed to launch Chromium',
          cause: error,
        });
      }
    }
  
    async createSession():
      Promise<BrowserSession> {
      if (!this.browser) {
        throw new BrowserControllerError({
          code: 'BROWSER_NOT_STARTED',
          operation: 'create-session',
          message:
            'Browser must be started before creating a session',
        });
      }
  
      try {
        const context =
          await this.browser.newContext();
  
        context.setDefaultTimeout(
          this.timeoutMs,
        );
  
        context.setDefaultNavigationTimeout(
          this.timeoutMs,
        );
  
        const page =
          await context.newPage();
  
        return new PlaywrightBrowserSession(
          context,
          page,
          this.artifactsDirectory,
        );
      } catch (error: unknown) {
        throw new BrowserControllerError({
          code: 'SESSION_CREATION_FAILED',
          operation: 'create-session',
          message:
            'Failed to create browser session',
          cause: error,
        });
      }
    }
  
    async close(): Promise<void> {
      if (!this.browser) {
        return;
      }
  
      try {
        await this.browser.close();
  
        this.browser = null;
      } catch (error: unknown) {
        throw new BrowserControllerError({
          code: 'BROWSER_CLOSE_FAILED',
          operation: 'close',
          message:
            'Failed to close browser',
          cause: error,
        });
      }
    }
  }
  
  class PlaywrightBrowserSession
    implements BrowserSession
  {
    private closed = false;
  
    private readonly observer:
      PlaywrightPageObserver;
  
    constructor(
      private readonly context:
        BrowserContext,
  
      private readonly page:
        Page,
  
      artifactsDirectory?:
        string,
    ) {
      this.observer =
        new PlaywrightPageObserver(
          this.page,
          artifactsDirectory,
        );
    }
  
    async navigate(
      url: string,
    ): Promise<void> {
      this.ensureOpen();
  
      try {
        await this.page.goto(
          url,
          {
            waitUntil:
              'domcontentloaded',
          },
        );
      } catch (error: unknown) {
        throw new BrowserControllerError({
          code: 'NAVIGATION_FAILED',
          operation: 'navigate',
          message:
            `Failed to navigate to ${url}`,
          cause: error,
        });
      }
    }
  
    async click(
      target: BrowserTarget,
    ): Promise<void> {
      this.ensureOpen();
  
      try {
        await this
          .resolveTarget(target)
          .click();
      } catch (error: unknown) {
        throw this.createActionError(
          'click',
          target,
          error,
        );
      }
    }
  
    async fill(
      target: BrowserTarget,
      value: string,
    ): Promise<void> {
      this.ensureOpen();
  
      try {
        await this
          .resolveTarget(target)
          .fill(value);
      } catch (error: unknown) {
        throw this.createActionError(
          'fill',
          target,
          error,
        );
      }
    }
  
    async select(
      target: BrowserTarget,
      value:
        | string
        | string[],
    ): Promise<void> {
      this.ensureOpen();
  
      try {
        await this
          .resolveTarget(target)
          .selectOption(value);
      } catch (error: unknown) {
        throw this.createActionError(
          'select',
          target,
          error,
        );
      }
    }
  
    async submit(
      target: BrowserTarget,
    ): Promise<void> {
      this.ensureOpen();
  
      try {
        const locator =
          this.resolveTarget(target);
  
        await locator.evaluate(
          (element) => {
            const form =
              element instanceof
                HTMLFormElement
                ? element
                : element.closest(
                    'form',
                  );
  
            if (!form) {
              throw new Error(
                'Target is not a form and is not inside a form',
              );
            }
  
            form.requestSubmit();
          },
        );
      } catch (error: unknown) {
        throw this.createActionError(
          'submit',
          target,
          error,
        );
      }
    }
  
    async back(): Promise<void> {
      this.ensureOpen();
  
      try {
        await this.page.goBack({
          waitUntil:
            'domcontentloaded',
        });
      } catch (error: unknown) {
        throw new BrowserControllerError({
          code: 'ACTION_FAILED',
          operation: 'back',
          message:
            'Failed to navigate back',
          cause: error,
        });
      }
    }
  
    async forward(): Promise<void> {
      this.ensureOpen();
  
      try {
        await this.page.goForward({
          waitUntil:
            'domcontentloaded',
        });
      } catch (error: unknown) {
        throw new BrowserControllerError({
          code: 'ACTION_FAILED',
          operation: 'forward',
          message:
            'Failed to navigate forward',
          cause: error,
        });
      }
    }
  
    async reload(): Promise<void> {
      this.ensureOpen();
  
      try {
        await this.page.reload({
          waitUntil:
            'domcontentloaded',
        });
      } catch (error: unknown) {
        throw new BrowserControllerError({
          code: 'ACTION_FAILED',
          operation: 'reload',
          message:
            'Failed to reload page',
          cause: error,
        });
      }
    }
  
    async wait(
      milliseconds: number,
    ): Promise<void> {
      this.ensureOpen();
  
      if (
        !Number.isFinite(
          milliseconds,
        ) ||
        milliseconds < 0
      ) {
        throw new BrowserControllerError({
          code: 'ACTION_FAILED',
          operation: 'wait',
          message:
            'Wait duration must be a non-negative number',
        });
      }
  
      await new Promise<void>(
        (resolve) => {
          setTimeout(
            resolve,
            milliseconds,
          );
        },
      );
    }
  
    getUrl(): string {
      this.ensureOpen();
  
      return this.page.url();
    }
  
    async getTitle():
      Promise<string> {
      this.ensureOpen();
  
      return this.page.title();
    }
  
    async observe():
      Promise<PageObservation> {
      this.ensureOpen();
  
      return this.observer.observe();
    }
  
    async close(): Promise<void> {
      if (this.closed) {
        return;
      }
  
      try {
        await this.context.close();
  
        this.closed = true;
      } catch (error: unknown) {
        throw new BrowserControllerError({
          code: 'ACTION_FAILED',
          operation: 'close',
          message:
            'Failed to close browser session',
          cause: error,
        });
      }
    }
  
    private resolveTarget(
      target: BrowserTarget,
    ): Locator {
      switch (target.by) {
        case 'role': {
          const options = {
            ...(target.name !==
            undefined
              ? {
                  name:
                    target.name,
                }
              : {}),
  
            ...(target.exact !==
            undefined
              ? {
                  exact:
                    target.exact,
                }
              : {}),
          };
  
          return this.page.getByRole(
            target.role as PlaywrightRole,
            options,
          );
        }
  
        case 'label':
          return this.page.getByLabel(
            target.label,
            this.buildExactOptions(
              target.exact,
            ),
          );
  
        case 'text':
          return this.page.getByText(
            target.text,
            this.buildExactOptions(
              target.exact,
            ),
          );
  
        case 'testId':
          return this.page.getByTestId(
            target.value,
          );
  
        case 'css':
          return this.page.locator(
            target.selector,
          );
      }
    }
  
    private buildExactOptions(
      exact?: boolean,
    ): {
      exact?: boolean;
    } {
      return exact === undefined
        ? {}
        : {
            exact,
          };
    }
  
    private ensureOpen(): void {
      if (this.closed) {
        throw new BrowserControllerError({
          code: 'SESSION_CLOSED',
          operation: 'close',
          message:
            'Browser session is already closed',
        });
      }
    }
  
    private createActionError(
      operation:
        | 'click'
        | 'fill'
        | 'select'
        | 'submit',
  
      target: BrowserTarget,
  
      cause: unknown,
    ): BrowserControllerError {
      return new BrowserControllerError({
        code: 'ACTION_FAILED',
        operation,
        message:
          `Browser ${operation} action failed ` +
          `for target ${JSON.stringify(target)}`,
        cause,
      });
    }
  }
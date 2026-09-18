import {
    mkdir,
  } from 'node:fs/promises';
  
  import {
    join,
  } from 'node:path';
  
  import type {
    ConsoleMessage,
    Page,
    Request,
    Response,
  } from 'playwright';
  
  import {
    actionElementSchema,
    pageObservationSchema,
    type ActionElement,
    type ConsoleEvent,
    type NetworkEvent,
    type PageObservation,
    type SupportingArtifact,
  } from '../contracts/page-observation.js';
  
  import type {
    PageObserver,
  } from './page-observer.js';
  
  export class PlaywrightPageObserver
    implements PageObserver
  {
    private readonly consoleEvents:
      ConsoleEvent[] = [];
  
    private readonly networkEvents =
      new Map<string, NetworkEvent>();
  
    private readonly requestIds =
      new WeakMap<Request, string>();
  
    private requestCounter = 0;
  
    constructor(
      private readonly page: Page,
      private readonly artifactsDirectory?:
        string,
    ) {
      this.attachListeners();
    }
  
    async observe():
      Promise<PageObservation> {
      const [
        title,
        semanticText,
        ariaSnapshot,
        actions,
      ] = await Promise.all([
        this.page.title(),
  
        this.captureSemanticText(),
  
        this.captureAriaSnapshot(),
  
        this.captureActions(),
      ]);
  
      const supportingArtifacts =
        await this.captureSupportingArtifacts();
  
      return pageObservationSchema.parse({
        capturedAt:
          new Date().toISOString(),
  
        url: this.page.url(),
  
        title,
  
        semanticText,
  
        ariaSnapshot,
  
        actions,
  
        consoleEvents: [
          ...this.consoleEvents,
        ],
  
        networkEvents: [
          ...this.networkEvents.values(),
        ],
  
        supportingArtifacts,
      });
    }
  
    private attachListeners(): void {
      this.page.on(
        'console',
        (message) => {
          this.handleConsoleMessage(
            message,
          );
        },
      );
  
      this.page.on(
        'request',
        (request) => {
          this.handleRequest(
            request,
          );
        },
      );
  
      this.page.on(
        'response',
        (response) => {
          this.handleResponse(
            response,
          );
        },
      );
  
      this.page.on(
        'requestfailed',
        (request) => {
          this.handleRequestFailure(
            request,
          );
        },
      );
    }
  
    private handleConsoleMessage(
      message: ConsoleMessage,
    ): void {
      const type = message.type();
  
      if (
        type !== 'warning' &&
        type !== 'error'
      ) {
        return;
      }
  
      this.consoleEvents.push({
        type,
        text: message.text(),
        timestamp:
          new Date().toISOString(),
      });
    }
  
    private handleRequest(
      request: Request,
    ): void {
      const id =
        this.getRequestId(
          request,
        );
  
      this.networkEvents.set(
        id,
        {
          id,
  
          method:
            request.method(),
  
          url:
            request.url(),
  
          resourceType:
            request.resourceType(),
  
          failed: false,
        },
      );
    }
  
    private handleResponse(
      response: Response,
    ): void {
      const request =
        response.request();
  
      const id =
        this.getRequestId(
          request,
        );
  
      const existing =
        this.networkEvents.get(
          id,
        );
  
      this.networkEvents.set(
        id,
        {
          ...(existing ?? {
            id,
  
            method:
              request.method(),
  
            url:
              request.url(),
  
            resourceType:
              request.resourceType(),
  
            failed: false,
          }),
  
          status:
            response.status(),
  
          ok:
            response.ok(),
  
          failed: false,
        },
      );
    }
  
    private handleRequestFailure(
      request: Request,
    ): void {
      const id =
        this.getRequestId(
          request,
        );
  
      const existing =
        this.networkEvents.get(
          id,
        );
  
      const failure =
        request.failure();
  
      this.networkEvents.set(
        id,
        {
          ...(existing ?? {
            id,
  
            method:
              request.method(),
  
            url:
              request.url(),
  
            resourceType:
              request.resourceType(),
  
            failed: true,
          }),
  
          failed: true,
  
          ...(failure?.errorText !==
          undefined
            ? {
                failureText:
                  failure.errorText,
              }
            : {}),
        },
      );
    }
  
    private getRequestId(
      request: Request,
    ): string {
      const existing =
        this.requestIds.get(
          request,
        );
  
      if (existing) {
        return existing;
      }
  
      const id =
        `request-${++this.requestCounter}`;
  
      this.requestIds.set(
        request,
        id,
      );
  
      return id;
    }
  
    private async captureSemanticText():
      Promise<string[]> {
      const body =
        this.page.locator(
          'body',
        );
  
      const text =
        await body.innerText();
  
      const unique =
        new Set(
          text
            .split('\n')
            .map(
              (value) =>
                value.trim(),
            )
            .filter(
              (value) =>
                value.length > 0,
            ),
        );
  
      return [
        ...unique,
      ];
    }
  
    private async captureAriaSnapshot():
      Promise<string> {
      return this.page
        .locator('body')
        .ariaSnapshot();
    }
  
    private async captureActions():
      Promise<ActionElement[]> {
      const rawActions =
        await this.page
          .locator(`
            a,
            button,
            input,
            select,
            textarea,
            form,
            menu,
            dialog,
            [role="button"],
            [role="link"],
            [role="menu"],
            [role="menuitem"],
            [role="dialog"],
            [role="alertdialog"],
            [role="checkbox"],
            [role="radio"]
          `)
          .evaluateAll(
            (elements) => {
              return elements.map(
                (element) => {
                  const htmlElement =
                    element as HTMLElement;
  
                  const tagName =
                    element.tagName
                      .toLowerCase();
  
                  const role =
                    element.getAttribute(
                      'role',
                    );
  
                  const ariaLabel =
                    element.getAttribute(
                      'aria-label',
                    );
  
                  const testId =
                    element.getAttribute(
                      'data-testid',
                    );
  
                  const placeholder =
                    element.getAttribute(
                      'placeholder',
                    );
  
                  const title =
                    element.getAttribute(
                      'title',
                    );
  
                  const text =
                    htmlElement.innerText
                      ?.trim() ||
                    undefined;
  
                  let labelText:
                    | string
                    | undefined;
  
                  if (
                    element instanceof
                      HTMLInputElement ||
                    element instanceof
                      HTMLSelectElement ||
                    element instanceof
                      HTMLTextAreaElement
                  ) {
                    labelText =
                      element.labels?.[0]
                        ?.textContent
                        ?.trim() ||
                      undefined;
                  }
  
                  const name =
                    ariaLabel ??
                    labelText ??
                    text ??
                    placeholder ??
                    title ??
                    undefined;
  
                  const href =
                    element instanceof
                    HTMLAnchorElement
                      ? element.href
                      : undefined;
  
                  const inputType =
                    element instanceof
                    HTMLInputElement
                      ? element.type
                      : undefined;
  
                  const disabled =
                    element.matches(
                      ':disabled',
                    ) ||
                    element.getAttribute(
                      'aria-disabled',
                    ) === 'true';
  
                  const rect =
                    htmlElement
                      .getBoundingClientRect();
  
                  const style =
                    window.getComputedStyle(
                      htmlElement,
                    );
  
                  const visible =
                    rect.width > 0 &&
                    rect.height > 0 &&
                    style.display !==
                      'none' &&
                    style.visibility !==
                      'hidden';
  
                  return {
                    tagName,
  
                    disabled,
  
                    visible,
  
                    ...(role
                      ? { role }
                      : {}),
  
                    ...(name
                      ? { name }
                      : {}),
  
                    ...(text
                      ? { text }
                      : {}),
  
                    ...(href
                      ? { href }
                      : {}),
  
                    ...(inputType
                      ? {
                          inputType,
                        }
                      : {}),
  
                    ...(testId
                      ? { testId }
                      : {}),
                  };
                },
              );
            },
          );
  
      const actions =
        rawActions.map(
          (action) => ({
            ...action,
  
            type:
              this.classifyActionType(
                action.tagName,
                action.role,
                action.inputType,
              ),
          }),
        );
  
      return actionElementSchema
        .array()
        .parse(actions);
    }
  
    private classifyActionType(
      tagName: string,
      role?: string,
      inputType?: string,
    ): ActionElement['type'] {
      if (
        role === 'checkbox' ||
        inputType ===
          'checkbox'
      ) {
        return 'checkbox';
      }
  
      if (
        role === 'radio' ||
        inputType === 'radio'
      ) {
        return 'radio';
      }
  
      if (
        role === 'button' ||
        tagName === 'button' ||
        (
          tagName === 'input' &&
          (
            inputType ===
              'submit' ||
            inputType ===
              'button' ||
            inputType ===
              'reset'
          )
        )
      ) {
        return 'button';
      }
  
      if (
        role === 'link' ||
        tagName === 'a'
      ) {
        return 'link';
      }
  
      if (
        tagName === 'select'
      ) {
        return 'select';
      }
  
      if (
        tagName ===
        'textarea'
      ) {
        return 'textarea';
      }
  
      if (
        tagName === 'input'
      ) {
        return 'input';
      }
  
      if (
        tagName === 'form'
      ) {
        return 'form';
      }
  
      if (
        role === 'dialog' ||
        role ===
          'alertdialog' ||
        tagName === 'dialog'
      ) {
        return 'dialog';
      }
  
      return 'menu';
    }
  
    private async captureSupportingArtifacts():
      Promise<
        SupportingArtifact[]
      > {
      if (
        !this.artifactsDirectory
      ) {
        return [];
      }
  
      try {
        await mkdir(
          this.artifactsDirectory,
          {
            recursive: true,
          },
        );
  
        const timestamp =
          Date.now();
  
        const path =
          join(
            this.artifactsDirectory,
            `page-${timestamp}.png`,
          );
  
        await this.page.screenshot({
          path,
          fullPage: true,
        });
  
        return [
          {
            type: 'screenshot',
            path,
          },
        ];
      } catch {
        // Supporting artifacts must not
        // break structured observation.
        return [];
      }
    }
  }
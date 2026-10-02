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
  implements PageObserver {
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
        [role="radio"],
        [role="combobox"],
        [role="listbox"],
        [contenteditable="true"],
        [contenteditable="plaintext-only"]
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


                const labelledBy =
                  element.getAttribute(
                    'aria-labelledby',
                  );

                const labelledByText =
                  labelledBy
                    ?.split(/\s+/)
                    .map(
                      (id) =>
                        document
                          .getElementById(id)
                          ?.textContent
                          ?.trim(),
                    )
                    .filter(
                      (
                        value,
                      ): value is string =>
                        Boolean(value),
                    )
                    .join(' ') ||
                  undefined;

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
                  labelledByText ??
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

                const contentEditable =
                  htmlElement.isContentEditable;
                // --------------------------------
                // Form-field metadata
                // --------------------------------

                let formField:
                  | {
                    htmlName?:
                    string;

                    inputType?:
                    string;

                    required:
                    boolean;

                    placeholder?:
                    string;

                    min?:
                    string;

                    max?:
                    string;

                    step?:
                    string;

                    minLength?:
                    number;

                    maxLength?:
                    number;

                    pattern?:
                    string;

                    accept?:
                    string;

                    multiple?:
                    boolean;

                    editable?:
                    boolean;

                    checked?:
                    boolean;

                    value?:
                    string;

                    options?: Array<{
                      value:
                      string;

                      label:
                      string;

                      disabled:
                      boolean;

                      selected:
                      boolean;
                    }>;
                  }
                  | undefined;

                // --------------------------------
                // Input metadata
                // --------------------------------

                if (
                  element instanceof
                  HTMLInputElement
                ) {
                  formField = {
                    required:
                      element.required,

                    ...(element.name
                      ? {
                        htmlName:
                          element.name,
                      }
                      : {}),

                    ...(element.type
                      ? {
                        inputType:
                          element.type,
                      }
                      : {}),

                    ...(element.placeholder
                      ? {
                        placeholder:
                          element.placeholder,
                      }
                      : {}),

                    ...(element.min
                      ? {
                        min:
                          element.min,
                      }
                      : {}),

                    ...(element.max
                      ? {
                        max:
                          element.max,
                      }
                      : {}),

                    ...(element.step
                      ? {
                        step:
                          element.step,
                      }
                      : {}),

                    ...(
                      element.minLength >= 0
                        ? {
                          minLength:
                            element.minLength,
                        }
                        : {}
                    ),

                    ...(
                      element.maxLength >= 0
                        ? {
                          maxLength:
                            element.maxLength,
                        }
                        : {}
                    ),

                    ...(element.pattern
                      ? {
                        pattern:
                          element.pattern,
                      }
                      : {}),

                    ...(element.accept
                      ? {
                        accept:
                          element.accept,
                      }
                      : {}),

                    ...(
                      element.type !==
                        'checkbox' &&
                      element.type !==
                        'radio'
                        ? {
                          value:
                            element.value,
                        }
                        : {}
                    ),

                    ...(
                      element.type ===
                        'checkbox' ||
                        element.type ===
                        'radio'
                        ? {
                          checked:
                            element.checked,
                        }
                        : {}
                    ),
                  };
                }

                // --------------------------------
                // Textarea metadata
                // --------------------------------

                if (
                  element instanceof
                  HTMLTextAreaElement
                ) {
                  formField = {
                    required:
                      element.required,

                    ...(element.name
                      ? {
                        htmlName:
                          element.name,
                      }
                      : {}),

                    ...(element.placeholder
                      ? {
                        placeholder:
                          element.placeholder,
                      }
                      : {}),

                    ...(
                      element.minLength >= 0
                        ? {
                          minLength:
                            element.minLength,
                        }
                        : {}
                    ),

                    ...(
                      element.maxLength >= 0
                        ? {
                          maxLength:
                            element.maxLength,
                        }
                        : {}
                    ),

                    value:
                      element.value,
                  };
                }

                // --------------------------------
                // Select metadata
                // --------------------------------

                if (
                  element instanceof
                  HTMLSelectElement
                ) {
                  formField = {
                    required:
                      element.required,

                    multiple:
                      element.multiple,

                    value:
                      element.value,

                    ...(element.name
                      ? {
                        htmlName:
                          element.name,
                      }
                      : {}),

                    options:
                      Array.from(
                        element.options,
                      ).map(
                        (option) => ({
                          value:
                            option.value,

                          label:
                            option.label,

                          disabled:
                            option.disabled,

                          selected:
                            option.selected,
                        }),
                      ),
                  };
                }

                // --------------------------------
                // ARIA/custom form controls
                // --------------------------------

                const ariaRequired =
                  element.getAttribute(
                    'aria-required',
                  ) === 'true';

                const ariaPlaceholder =
                  element.getAttribute(
                    'aria-placeholder',
                  );

                    const optionElements =
                    new Set<Element>();
                  
                  if (
                    role === 'listbox'
                  ) {
                    element
                      .querySelectorAll(
                        '[role="option"]',
                      )
                      .forEach(
                        (option) =>
                          optionElements.add(
                            option,
                          ),
                      );
                  }
                  
                  const controlledIds = [
                    element.getAttribute(
                      'aria-controls',
                    ),
                    element.getAttribute(
                      'aria-owns',
                    ),
                  ]
                    .filter(
                      (
                        value,
                      ): value is string =>
                        Boolean(value),
                    )
                    .flatMap(
                      (value) =>
                        value.split(
                          /\s+/,
                        ),
                    );
                  
                  for (
                    const id of
                    controlledIds
                  ) {
                    const controlled =
                      document.getElementById(
                        id,
                      );
                  
                    controlled
                      ?.querySelectorAll(
                        '[role="option"]',
                      )
                      .forEach(
                        (option) =>
                          optionElements.add(
                            option,
                          ),
                      );
                  }
                  
                  const ariaOptions = [
                    ...optionElements,
                  ].map(
                    (option) => {
                      const label =
                        option.textContent
                          ?.trim() ??
                        '';
                  
                      return {
                        value:
                          option.getAttribute(
                            'data-value',
                          ) ??
                          option.getAttribute(
                            'value',
                          ) ??
                          label,
                  
                        label,
                  
                        disabled:
                          option.getAttribute(
                            'aria-disabled',
                          ) === 'true',
                  
                        selected:
                          option.getAttribute(
                            'aria-selected',
                          ) === 'true',
                      };
                    },
                  );

                  if (
                    (
                      role === 'checkbox' ||
                      role === 'radio'
                    ) &&
                    !(element instanceof
                      HTMLInputElement)
                  ) {
                    formField = {
                      required:
                        ariaRequired,
                  
                      checked:
                        element.getAttribute(
                          'aria-checked',
                        ) === 'true',
                  
                      editable:
                        false,
                    };
                  }

                  if (
                    role === 'combobox'
                  ) {
                    const options =
                    ariaOptions;
                  
                    formField = {
                      ...(formField ?? {
                        required:
                          ariaRequired,
                      }),
                  
                      required:
                        formField?.required ||
                        ariaRequired,
                  
                      editable:
                        element instanceof
                          HTMLInputElement ||
                        contentEditable,
                  
                      ...(ariaPlaceholder
                        ? {
                            placeholder:
                              ariaPlaceholder,
                          }
                        : {}),
                  
                      ...(options.length > 0
                        ? {
                            options,
                          }
                        : {}),
                    };
                  }

                  if (
                    role === 'listbox'
                  ) {
                    const options =
                    ariaOptions;
                  
                    formField = {
                      required:
                        ariaRequired,
                  
                      editable:
                        false,
                  
                      ...(options.length > 0
                        ? {
                            options,
                          }
                        : {}),
                    };
                  }

                  if (
                    contentEditable &&
                    role !== 'combobox'
                  ) {
                    formField = {
                      required:
                        ariaRequired,
                  
                      inputType:
                        'text',
                  
                      editable:
                        true,
                  
                      ...(ariaPlaceholder
                        ? {
                            placeholder:
                              ariaPlaceholder,
                          }
                        : {}),
                    };
                  }



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

                  contentEditable,

                  disabled,

                  visible,

                  ...(role
                    ? {
                      role,
                    }
                    : {}),

                  ...(name
                    ? {
                      name,
                    }
                    : {}),

                  ...(text
                    ? {
                      text,
                    }
                    : {}),

                  ...(href
                    ? {
                      href,
                    }
                    : {}),

                  ...(inputType
                    ? {
                      inputType,
                    }
                    : {}),

                  ...(formField
                    ? {
                      formField,
                    }
                    : {}),

                  ...(testId
                    ? {
                      testId,
                    }
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
              action.contentEditable,
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
    contentEditable = false,
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
      role === 'combobox'
    ) {
      return 'combobox';
    }
    
    if (
      role === 'listbox'
    ) {
      return 'listbox';
    }
    
    if (contentEditable) {
      return 'contenteditable';
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
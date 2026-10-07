import type {
    BrowserTarget,
  } from '../browser/index.js';
  
  function quote(
    value: string,
  ): string {
    return JSON.stringify(
      value,
    );
  }

  function withIndex(
    locator:
      string,

    index?:
      number,
  ): string {
    return index ===
      undefined
      ? locator
      : `${locator}.nth(${index})`;
  }

  function normalizeAccessibleName(
    value: string,
  ): string {
    return value
      .replace(
        /\s+/g,
        ' ',
      )
      .trim();
  }
  
  export function renderPlaywrightLocator(
    target:
      BrowserTarget,
  ): string {
    switch (
      target.by
    ) {
      case 'role': {
        const options: string[] =
          [];
  
        if (
          target.name !==
          undefined
        ) {
          options.push(
            `name: ${quote(
              normalizeAccessibleName(
                target.name,
              ),
            )}`,
          );
        }
  
        if (
          target.exact !==
          undefined
        ) {
          options.push(
            `exact: ${target.exact}`,
          );
        }
  
        const optionBlock =
          options.length > 0
            ? `, { ${options.join(
                ', ',
              )} }`
            : '';
  
        return withIndex(
          [
            'page.getByRole(',
            quote(
              target.role,
            ),
            optionBlock,
            ')',
          ].join(''),

          target.index,
        );
      }
  
      case 'label':
        return withIndex(
          [
            'page.getByLabel(',
            quote(
              target.label,
            ),
            target.exact !==
            undefined
              ? `, { exact: ${target.exact} }`
              : '',
            ')',
          ].join(''),

          target.index,
        );
  
      case 'placeholder':
        return withIndex(
          [
            'page.getByPlaceholder(',
            quote(
              target.placeholder,
            ),
            target.exact !==
            undefined
              ? `, { exact: ${target.exact} }`
              : '',
            ')',
          ].join(''),

          target.index,
        );
  
      case 'text':
        return withIndex(
          [
            'page.getByText(',
            quote(
              target.text,
            ),
            target.exact !==
            undefined
              ? `, { exact: ${target.exact} }`
              : '',
            ')',
          ].join(''),

          target.index,
        );
  
      case 'testId':
        return withIndex(
          [
            'page.getByTestId(',
            quote(
              target.value,
            ),
            ')',
          ].join(''),

          target.index,
        );
  
      case 'css':
        return withIndex(
          [
            'page.locator(',
            quote(
              target.selector,
            ),
            ')',
          ].join(''),

          target.index,
        );
    }
  }
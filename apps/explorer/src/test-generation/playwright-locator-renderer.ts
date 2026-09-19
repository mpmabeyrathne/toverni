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
              target.name,
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
  
        return [
          'page.getByRole(',
          quote(
            target.role,
          ),
          optionBlock,
          ')',
        ].join('');
      }
  
      case 'label':
        return [
          'page.getByLabel(',
          quote(
            target.label,
          ),
          target.exact !==
          undefined
            ? `, { exact: ${target.exact} }`
            : '',
          ')',
        ].join('');
  
      case 'text':
        return [
          'page.getByText(',
          quote(
            target.text,
          ),
          target.exact !==
          undefined
            ? `, { exact: ${target.exact} }`
            : '',
          ')',
        ].join('');
  
      case 'testId':
        return [
          'page.getByTestId(',
          quote(
            target.value,
          ),
          ')',
        ].join('');
  
      case 'css':
        return [
          'page.locator(',
          quote(
            target.selector,
          ),
          ')',
        ].join('');
    }
  }
import type {
    ActionElement,
  } from '../contracts/page-observation.js';
  
  import type {
    BrowserTarget,
  } from '../browser/browser-target.js';
  
  function normalize(
    value: string,
  ): string {
    return value
      .toLowerCase()
      .replace(
        /\s+/g,
        ' ',
      )
      .trim();
  }
  
  export function getActionLabel(
    action: ActionElement,
  ): string {
    return (
      action.name ??
      action.text ??
      action.href ??
      `${action.type}:${action.tagName}`
    );
  }
  
  export function createActionSignature(
    action: ActionElement,
  ): string {
    return [
      action.type,
  
      action.role ?? '',
  
      normalize(
        action.name ?? '',
      ),
  
      normalize(
        action.text ?? '',
      ),
  
      action.href ?? '',
  
      action.inputType ?? '',
  
      action.testId ?? '',
    ].join('|');
  }
  
  export function createBrowserTarget(
    action: ActionElement,
  ): BrowserTarget | null {
    if (action.testId) {
      return {
        by: 'testId',
        value:
          action.testId,
      };
    }
  
    if (
      action.role &&
      action.name
    ) {
      return {
        by: 'role',
        role:
          action.role,
        name:
          action.name,
        exact: true,
      };
    }
  
    if (
      action.type === 'button' &&
      action.name
    ) {
      return {
        by: 'role',
        role: 'button',
        name:
          action.name,
        exact: true,
      };
    }
  
    if (
      action.type === 'link' &&
      action.name
    ) {
      return {
        by: 'role',
        role: 'link',
        name:
          action.name,
        exact: true,
      };
    }
  
    if (
      (
        action.type ===
          'input' ||
        action.type ===
          'select' ||
        action.type ===
          'textarea'
      ) &&
      action.name
    ) {
      return {
        by: 'label',
        label:
          action.name,
        exact: true,
      };
    }
  
    if (action.text) {
      return {
        by: 'text',
        text:
          action.text,
        exact: true,
      };
    }
  
    return null;
  }
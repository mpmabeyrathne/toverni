import {
    createHash,
  } from 'node:crypto';
  
  import type {
    ActionElement,
    PageObservation,
  } from '../contracts/page-observation.js';
  
  import {
    deriveRoutePattern,
  } from './route-pattern.js';
  
  export interface StateFingerprint {
    fingerprint: string;
  
    routePattern: string;
  
    semanticStructure:
      string[];
  
    actionSignatures:
      string[];
  
    signals: {
      title: string;
  
      actionCount: number;
  
      visibleActionCount:
        number;
  
      disabledActionCount:
        number;
  
      dialogCount: number;
  
      formCount: number;
    };
  }
  
  function normalizeDynamicText(
    value: string,
  ): string {
    return value
      .toLowerCase()
  
      .replace(
        /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi,
        ':id',
      )
  
      .replace(
        /\b[0-9a-f]{24}\b/gi,
        ':id',
      )
  
      .replace(
        /\b\d+\b/g,
        ':number',
      )
  
      .replace(
        /\s+/g,
        ' ',
      )
  
      .trim();
  }
  
  function normalizeAriaStructure(
    snapshot: string,
  ): string[] {
    return snapshot
      .split('\n')
      .map((line) => {
        const leadingSpaces =
          line.length -
          line.trimStart().length;
  
        const depth =
          Math.floor(
            leadingSpaces / 2,
          );
  
        const normalized =
          line
            .trim()
  
            .replace(
              /"[^"]*"/g,
              '"<name>"',
            )
  
            .replace(
              /\/url:\s+.*/g,
              '/url',
            );
  
        return `${depth}:${normalized}`;
      })
      .filter(
        (line) =>
          line.length > 2,
      );
  }
  
  function normalizeHref(
    href: string | undefined,
  ): string {
    if (!href) {
      return '';
    }
  
    try {
      return deriveRoutePattern(
        href,
      );
    } catch {
      return normalizeDynamicText(
        href,
      );
    }
  }
  
  function createActionSignature(
    action: ActionElement,
  ): string {
    const parts = [
      action.type,
  
      action.tagName,
  
      action.role ?? '',
  
      normalizeDynamicText(
        action.name ?? '',
      ),
  
      normalizeHref(
        action.href,
      ),
  
      action.inputType ?? '',
  
      action.disabled
        ? 'disabled'
        : 'enabled',
  
      action.visible
        ? 'visible'
        : 'hidden',
    ];
  
    return parts.join('|');
  }
  
  export function createStateFingerprint(
    observation: PageObservation,
  ): StateFingerprint {
    const routePattern =
      deriveRoutePattern(
        observation.url,
      );
  
    const semanticStructure =
      normalizeAriaStructure(
        observation.ariaSnapshot,
      );
  
    const actionSignatures =
      observation.actions
        .map(
          createActionSignature,
        )
        .sort();
  
    const signals = {
      title:
        normalizeDynamicText(
          observation.title,
        ),
  
      actionCount:
        observation.actions.length,
  
      visibleActionCount:
        observation.actions.filter(
          (action) =>
            action.visible,
        ).length,
  
      disabledActionCount:
        observation.actions.filter(
          (action) =>
            action.disabled,
        ).length,
  
      dialogCount:
        observation.actions.filter(
          (action) =>
            action.type ===
            'dialog',
        ).length,
  
      formCount:
        observation.actions.filter(
          (action) =>
            action.type ===
            'form',
        ).length,
    };
  
    const fingerprintInput =
      JSON.stringify({
        routePattern,
  
        semanticStructure,
  
        actionSignatures,
  
        signals,
      });
  
    const fingerprint =
      createHash('sha256')
        .update(fingerprintInput)
        .digest('hex');
  
    return {
      fingerprint,
  
      routePattern,
  
      semanticStructure,
  
      actionSignatures,
  
      signals,
    };
  }
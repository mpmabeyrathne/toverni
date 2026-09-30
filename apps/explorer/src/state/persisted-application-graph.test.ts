import {
    describe,
    expect,
    it,
  } from 'vitest';
  
  import type {
    PageObservation,
  } from '../contracts/page-observation.js';
  
  import {
    mapPersistedApplicationGraph,
  } from './persisted-application-graph.js';
  
  const observation:
    PageObservation = {
      capturedAt:
        '2026-09-30T10:00:00.000Z',
  
      url:
        'https://example.test/products',
  
      title:
        'Products',
  
      semanticText: [
        'Products',
        'Add to cart',
      ],
  
      ariaSnapshot:
        '- button "Add to cart"',
  
      actions: [],
  
      consoleEvents: [],
  
      networkEvents: [],
  
      supportingArtifacts: [],
    };
  
  describe(
    'mapPersistedApplicationGraph',
    () => {
      it(
        'maps persisted states, transitions, and evidence into the domain graph',
        () => {
          const transitionId =
            'transition-1';
  
          const result =
            mapPersistedApplicationGraph({
              states: [
                {
                  id:
                    'state-1',
  
                  applicationId:
                    'application-1',
  
                  fingerprint:
                    'fingerprint-1',
  
                  routePattern:
                    '/products',
  
                  latestUrl:
                    'https://example.test/products',
  
                  latestTitle:
                    'Products',
  
                  visitCount:
                    3,
  
                  observation,
  
                  firstSeenAt:
                    new Date(
                      '2026-09-30T09:00:00.000Z',
                    ),
  
                  lastSeenAt:
                    new Date(
                      '2026-09-30T10:00:00.000Z',
                    ),
                },
  
                {
                  id:
                    'state-2',
  
                  applicationId:
                    'application-1',
  
                  fingerprint:
                    'fingerprint-2',
  
                  routePattern:
                    '/cart',
  
                  latestUrl:
                    'https://example.test/cart',
  
                  latestTitle:
                    'Cart',
  
                  visitCount:
                    1,
  
                  observation: {
                    ...observation,
  
                    url:
                      'https://example.test/cart',
  
                    title:
                      'Cart',
                  },
  
                  firstSeenAt:
                    new Date(
                      '2026-09-30T10:01:00.000Z',
                    ),
  
                  lastSeenAt:
                    new Date(
                      '2026-09-30T10:01:00.000Z',
                    ),
                },
              ],
  
              transitions: [
                {
                  id:
                    transitionId,
  
                  runId:
                    'run-1',
  
                  fromStateId:
                    'state-1',
  
                  toStateId:
                    'state-2',
  
                  actionId:
                    'action-1',
  
                  actionType:
                    'click',
  
                  actionTarget:
                    '#add-to-cart',
  
                  equivalentState:
                    false,
  
                  explorationBlocked:
                    false,
  
                  beforeObservation:
                    observation,
  
                  afterObservation: {
                    ...observation,
  
                    url:
                      'https://example.test/cart',
  
                    title:
                      'Cart',
                  },
  
                  occurredAt:
                    new Date(
                      '2026-09-30T10:01:00.000Z',
                    ),
                },
              ],
  
              networkEvents: [
                {
                  id:
                    'network-row-1',
  
                  runId:
                    'run-1',
  
                  stateId:
                    'state-2',
  
                  transitionId,
  
                  requestId:
                    'request-1',
  
                  method:
                    'POST',
  
                  url:
                    'https://example.test/api/cart',
  
                  resourceType:
                    'fetch',
  
                  status:
                    200,
  
                  ok:
                    true,
  
                  failed:
                    false,
  
                  failureText:
                    null,
  
                  capturedAt:
                    new Date(
                      '2026-09-30T10:01:00.000Z',
                    ),
                },
              ],
  
              consoleEvents: [
                {
                  id:
                    'console-row-1',
  
                  runId:
                    'run-1',
  
                  stateId:
                    'state-2',
  
                  transitionId,
  
                  type:
                    'warning',
  
                  text:
                    'Example warning',
  
                  occurredAt:
                    new Date(
                      '2026-09-30T10:01:01.000Z',
                    ),
                },
              ],
            });
  
          expect(
            result.states,
          ).toHaveLength(2);
  
          expect(
            result.states[0],
          ).toMatchObject({
            id:
              'state-1',
  
            fingerprint:
              'fingerprint-1',
  
            routePattern:
              '/products',
  
            url:
              'https://example.test/products',
  
            title:
              'Products',
  
            visits:
              3,
  
            firstSeenAt:
              '2026-09-30T09:00:00.000Z',
  
            lastSeenAt:
              '2026-09-30T10:00:00.000Z',
          });
  
          expect(
            result.transitions,
          ).toHaveLength(1);
  
          expect(
            result.transitions[0],
          ).toMatchObject({
            id:
              transitionId,
  
            fromStateId:
              'state-1',
  
            toStateId:
              'state-2',
  
            action: {
              type:
                'click',
  
              target:
                '#add-to-cart',
            },
  
            occurredAt:
              '2026-09-30T10:01:00.000Z',
  
            equivalentState:
              false,
  
            explorationBlocked:
              false,
          });
  
          expect(
            result
              .transitions[0]
              ?.evidence
              .networkEvents,
          ).toEqual([
            {
              id:
                'request-1',
  
              method:
                'POST',
  
              url:
                'https://example.test/api/cart',
  
              resourceType:
                'fetch',
  
              status:
                200,
  
              ok:
                true,
  
              failed:
                false,
            },
          ]);
  
          expect(
            result
              .transitions[0]
              ?.evidence
              .consoleEvents,
          ).toEqual([
            {
              type:
                'warning',
  
              text:
                'Example warning',
  
              timestamp:
                '2026-09-30T10:01:01.000Z',
            },
          ]);
        },
      );
  
      it(
        'does not attach evidence from another transition',
        () => {
          const result =
            mapPersistedApplicationGraph({
              states: [],
  
              transitions: [
                {
                  id:
                    'transition-1',
  
                  runId:
                    'run-1',
  
                  fromStateId:
                    'state-1',
  
                  toStateId:
                    'state-2',
  
                  actionId:
                    null,
  
                  actionType:
                    'navigate',
  
                  actionTarget:
                    null,
  
                  equivalentState:
                    false,
  
                  explorationBlocked:
                    false,
  
                  beforeObservation:
                    observation,
  
                  afterObservation:
                    observation,
  
                  occurredAt:
                    new Date(
                      '2026-09-30T10:00:00.000Z',
                    ),
                },
              ],
  
              networkEvents: [
                {
                  id:
                    'network-row-2',
  
                  runId:
                    'run-1',
  
                  stateId:
                    'state-3',
  
                  transitionId:
                    'transition-2',
  
                  requestId:
                    'request-2',
  
                  method:
                    'GET',
  
                  url:
                    'https://example.test/api/other',
  
                  resourceType:
                    'fetch',
  
                  status:
                    200,
  
                  ok:
                    true,
  
                  failed:
                    false,
  
                  failureText:
                    null,
  
                  capturedAt:
                    new Date(
                      '2026-09-30T10:00:00.000Z',
                    ),
                },
              ],
  
              consoleEvents: [],
            });
  
          expect(
            result
              .transitions[0]
              ?.evidence
              .networkEvents,
          ).toEqual([]);
        },
      );
    },
  );
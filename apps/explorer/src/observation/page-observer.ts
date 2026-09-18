import type {
    PageObservation,
  } from '../contracts/page-observation.js';
  
  export interface PageObserver {
    observe(): Promise<PageObservation>;
  }
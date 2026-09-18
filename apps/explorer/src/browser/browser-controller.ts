import type {
    BrowserSession,
  } from './browser-session.js';
  
  export interface BrowserControllerOptions {
    headless?: boolean;
  
    timeoutMs?: number;
  
    artifactsDirectory?: string;
  }
  
  export interface BrowserController {
    start(): Promise<void>;
  
    createSession():
      Promise<BrowserSession>;
  
    close(): Promise<void>;
  }
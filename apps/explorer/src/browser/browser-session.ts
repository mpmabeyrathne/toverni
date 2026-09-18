import type { BrowserTarget } from './browser-target.js';

export interface BrowserSession {
  navigate(url: string): Promise<void>;

  click(target: BrowserTarget): Promise<void>;

  fill(
    target: BrowserTarget,
    value: string,
  ): Promise<void>;

  select(
    target: BrowserTarget,
    value: string | string[],
  ): Promise<void>;

  submit(target: BrowserTarget): Promise<void>;

  back(): Promise<void>;

  forward(): Promise<void>;

  reload(): Promise<void>;

  wait(milliseconds: number): Promise<void>;

  getUrl(): string;

  getTitle(): Promise<string>;

  close(): Promise<void>;
}
export type BrowserTarget =
  | {
      by: 'role';
      role: string;
      name?: string;
      exact?: boolean;
    }
  | {
      by: 'label';
      label: string;
      exact?: boolean;
    }
  | {
      by: 'text';
      text: string;
      exact?: boolean;
    }
  | {
      by: 'testId';
      value: string;
    }
  | {
      by: 'css';
      selector: string;
    };
export type BrowserTarget =
  | {
      by: 'role';
      role: string;
      name?: string;
      exact?: boolean;
      index?: number;
    }
  | {
      by: 'label';
      label: string;
      exact?: boolean;
      index?: number;
    }
  | {
      by: 'text';
      text: string;
      exact?: boolean;
      index?: number;
    }
  | {
      by: 'testId';
      value: string;
      index?: number;
    }
  | {
      by: 'css';
      selector: string;
      index?: number;
    };

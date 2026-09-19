# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: artifacts\generated-tests\a900c61b-01a1-4eab-b7e1-62e9a71a11c2\cefa7003-b02a-4515-a8ca-d0cacb6931cd.spec.ts >> Navigation: Add Mouse to Cart
- Location: artifacts\generated-tests\a900c61b-01a1-4eab-b7e1-62e9a71a11c2\cefa7003-b02a-4515-a8ca-d0cacb6931cd.spec.ts:12:1

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: 'Add Mouse to Cart', exact: true })
    - locator resolved to <button disabled type="button">↵        Add Mouse to Cart↵      </button>
  - attempting click action
    2 × waiting for element to be visible, enabled and stable
      - element is not enabled
    - retrying click action
    - waiting 20ms
    2 × waiting for element to be visible, enabled and stable
      - element is not enabled
    - retrying click action
      - waiting 100ms
    57 × waiting for element to be visible, enabled and stable
       - element is not enabled
     - retrying click action
       - waiting 500ms

```

# Page snapshot

```yaml
- main [ref=e2]:
  - heading "Products" [level=1] [ref=e3]
  - text: Search products
  - textbox "Search products" [ref=e4]
  - button "Search Products" [ref=e5]
  - generic [ref=e6]:
    - heading "Mechanical Keyboard" [level=2] [ref=e7]
    - paragraph [ref=e8]: Available
    - button "Add Keyboard to Cart" [ref=e9]
  - generic [ref=e10]:
    - heading "Gaming Mouse" [level=2] [ref=e11]
    - paragraph [ref=e12]: Unavailable
    - button "Add Mouse to Cart" [disabled] [ref=e13]
  - generic [ref=e14]:
    - heading "Cart" [level=2] [ref=e15]
    - paragraph [ref=e16]: Cart is empty
    - button "Remove from Cart" [disabled] [ref=e17]
```

# Test source

```ts
  1  | import { test } from '@playwright/test';
  2  | 
  3  | const scenario = {
  4  |   id: "cefa7003-b02a-4515-a8ca-d0cacb6931cd",
  5  |   evidenceReferences: [
  6  |   "ACTION-2"
  7  | ],
  8  | } as const;
  9  | 
  10 | void scenario;
  11 | 
  12 | test("Navigation: Add Mouse to Cart", async ({ page }) => {
  13 |   await page.goto("http://127.0.0.1:6014");
  14 | 
  15 |   // Evidence: ACTION-2
  16 |   // Add Mouse to Cart
> 17 |   await page.getByRole("button", { name: "Add Mouse to Cart", exact: true }).click();
     |                                                                              ^ Error: locator.click: Test timeout of 30000ms exceeded.
  18 | 
  19 | });
  20 | 
```
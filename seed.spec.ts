import {
  expect,
  test,
} from '@playwright/test';

test(
  'booking benchmark seed',
  async ({
    page,
  }) => {
    await page.goto(
      'http://127.0.0.1:4173/',
    );

    await expect(
      page.getByRole(
        'heading',
        {
          name:
            'Room Booking',
        },
      ),
    ).toBeVisible();
  },
);

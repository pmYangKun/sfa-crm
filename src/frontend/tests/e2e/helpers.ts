import { Page, Route } from '@playwright/test';

export async function mockChatStream(page: Page, responseText: string) {
  await page.route('**/api/chat', async (route: Route) => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      body: Buffer.from(responseText, 'utf-8'),
    });
  });
}

export async function ensureBackendUp(page: Page): Promise<boolean> {
  try {
    const resp = await page.request.get('http://localhost:8000/api/v1/auth/me', {
      failOnStatusCode: false,
    });
    return resp.status() === 200 || resp.status() === 401;
  } catch {
    return false;
  }
}

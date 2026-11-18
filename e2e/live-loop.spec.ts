import { devices, expect, test, type Page } from '@playwright/test';

async function joinAs(page: Page, pin: string, nickname: string) {
  await page.goto(`/join/${pin}`);
  await page.getByLabel('Nick').fill(nickname);
  await page.getByRole('button', { name: 'Wchodzę' }).click();
  await expect(page.getByText('Jesteś w grze')).toBeVisible();
}

test('host runs a quiz, phones join by PIN, answer, see results and survive a refresh', async ({ browser }) => {
  const host = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  await host.goto('/host');
  await host.getByText('Rozgrzewka').click();
  await host.getByRole('button', { name: /Otwórz lobby/ }).click();
  await expect(host).toHaveURL(/\/live\//);
  const pin = ((await host.getByLabel(/^PIN \d{6}$/).getAttribute('aria-label')) ?? '').replace(/\D/g, '');
  expect(pin).toMatch(/^\d{6}$/);

  const phone = { ...devices['iPhone 13'] };
  const ola = await (await browser.newContext(phone)).newPage();
  const ben = await (await browser.newContext(phone)).newPage();
  await joinAs(ola, pin, 'Ola');
  await joinAs(ben, pin, 'Ben');
  await expect(host.getByText('Ola', { exact: true })).toBeVisible();

  // Same nickname, different case, is refused with a clear message.
  const dup = await (await browser.newContext(phone)).newPage();
  await dup.goto('/');
  await dup.getByLabel('PIN gry').fill(pin);
  await dup.getByRole('button', { name: 'Dalej' }).click();
  await dup.getByLabel('Nick').fill('OLA');
  await dup.getByRole('button', { name: 'Wchodzę' }).click();
  await expect(dup.getByRole('alert')).toHaveText('Ten nick jest zajęty. Dodaj cyfrę albo wybierz inny.');

  await host.getByRole('button', { name: 'Start' }).click(); // content slide
  await expect(ola.getByText('Slajd jest na ekranie')).toBeVisible();
  await host.keyboard.press('Space'); // question 1
  await expect(ola.getByRole('button', { name: 'B: Merkury' })).toBeVisible();
  await expect(host.getByRole('timer')).toBeVisible();

  await ola.getByRole('button', { name: 'B: Merkury' }).click();
  await expect(ola.getByText('Odpowiedź zapisana')).toBeVisible();

  // A refresh mid-question restores the player in place.
  await ben.reload();
  await ben.getByRole('button', { name: 'A: Wenus' }).click();

  await expect(ola.getByText('Dobrze!')).toBeVisible();
  await expect(ben.getByText('Tym razem nie')).toBeVisible();
  await expect(ben.getByText('B: Merkury')).toBeVisible();
  await expect(host.getByText('50% poprawnych')).toBeVisible();

  await host.keyboard.press('Space'); // leaderboard
  await expect(host.getByRole('heading', { name: 'Ranking' })).toBeVisible();
  await expect(ola.getByText('#1')).toBeVisible();

  await host.getByRole('button', { name: 'Zakończ grę' }).click();
  await host.getByRole('button', { name: 'Tak, zakończ' }).click();
  await expect(ola.getByText('Wynik końcowy')).toBeVisible();
  await expect(ola.getByText('1 z 4 poprawnych')).toBeVisible();
});

test('an unknown PIN is refused before the nickname step', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('PIN gry').fill('000001');
  await page.getByRole('button', { name: 'Dalej' }).click();
  await expect(page.getByRole('alert')).toHaveText('Nie ma gry z tym PIN-em. Sprawdź go na ekranie.');
});

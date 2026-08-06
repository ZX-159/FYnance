// lib/demo.js — randomised demo card number.
// The user's REAL card ID is never displayed in the UI (privacy):
// the wallet card, footers and onboarding examples show a randomly
// generated 10-digit number instead, generated once per session.

function random10() {
  let d = '';
  for (let i = 0; i < 10; i++) d += Math.floor(Math.random() * 10);
  return d;
}

export const DEMO_CARD = random10();

/** Masked display form: ••••  ••••  1234 */
export function maskDemo() {
  return `••••  ••••  ${DEMO_CARD.slice(-4)}`;
}

/** Full demo number, space-grouped: 1234 5678 9012 */
export function demoGrouped() {
  return DEMO_CARD.replace(/(\d{4})(?=\d)/g, '$1 ');
}

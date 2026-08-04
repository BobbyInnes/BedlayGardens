# Live payment smoke test (pre-launch)

A checklist for verifying real Stripe payments end-to-end on production,
right before going live, using a real £1 charge. Do this once, in a narrow
window, immediately before announcing launch.

## Before you start

- [ ] Pick a low-traffic window — makes any mess easy to spot and clean up.
- [ ] Decide on a marker for the test booking (e.g. an email alias like
      `you+smoketest@example.com`) so it's unmistakable in prod data
      afterward.
- [ ] Confirm you have a card you're happy to charge £1 to and refund.

## Switch to live Stripe

- [ ] Set `STRIPE_SECRET_KEY` (and publishable key) to the **live** values in
      the production environment.
- [ ] In the Stripe dashboard, confirm the **live** webhook endpoint is
      configured and points at the production URL, and copy its **live**
      signing secret into `STRIPE_WEBHOOK_SECRET`.

## Run the real transaction

- [ ] Create a real booking on the live site using the £1 service/price and
      the marked test email, and pay with a real card.
- [ ] Confirm the webhook fires and the booking/payment record updates
      correctly (check Stripe dashboard event log + the booking in the app).
- [ ] Separately verify the **reconciliation fallback** on the confirmation
      page would also catch this payment if the webhook had failed or been
      delayed (e.g. check what the confirmation page does before the webhook
      has arrived).

## Clean up

- [ ] Refund the charge in the Stripe dashboard.
- [ ] Verify the booking/payment record reflects the refund correctly (not
      just that Stripe shows it refunded).
- [ ] Delete or clearly archive the test booking from production so it
      doesn't appear in real reports/dashboards.
- [ ] If the site isn't actually launching yet, swap back to Stripe **test**
      mode keys — don't leave live keys active with no traffic expected.

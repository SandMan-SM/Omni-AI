// ── Interlinked Premium — single source of truth for pricing + Stripe URL ──
//
// The Stripe assets were provisioned via MCP on 2026-04-23:
//   • product  prod_UO2Z7JcvNmSVKp
//   • price    price_1TPGUdE1uHPZaaHpijPupik6  ($40/mo recurring)
//   • coupon   6vMPDM7L                        (50% off, duration=once)
//   • promo    FIRST50                         (first_time_transaction=true)
//   • link     plink_1TPGVdE1uHPZaaHpW678CxPm
//
// Payment link has allow_promotion_codes=true, so appending
// ?prefilled_promo_code=FIRST50 auto-applies the 50%-off-first-month
// coupon on Stripe's hosted checkout page. Stripe then bills $40/mo
// starting from month two.

export const PREMIUM_MONTHLY_PRICE_USD = 40;
export const PREMIUM_FIRST_MONTH_PRICE_USD = 20;
export const PREMIUM_FIRST_MONTH_DISCOUNT_PCT = 50;

export const PREMIUM_PAYMENT_LINK =
  "https://buy.stripe.com/fZuaEXe1Q7qM7bp0lW9fW02?prefilled_promo_code=FIRST50";

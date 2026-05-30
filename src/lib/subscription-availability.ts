type SubscriptionAvailabilityInput = {
  isSubscription: boolean;
  priceWeekly?: number | null;
  priceBiweekly?: number | null;
  priceMonthly?: number | null;
  priceQuarterly?: number | null;
};

export function hasAvailableSubscription(product: SubscriptionAvailabilityInput) {
  return (
    product.isSubscription &&
    [product.priceWeekly, product.priceBiweekly, product.priceMonthly, product.priceQuarterly].some(
      (price) => typeof price === "number" && price > 0,
    )
  );
}

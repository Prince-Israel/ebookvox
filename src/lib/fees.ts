/** The platform keeps 15% of every sale; the publisher receives the other 85%. */
export const PLATFORM_FEE_PCT = 15;

/** The platform's share in integer minor units, rounded down so the publisher's share is never short-changed by a rounding error. */
export const feeOf = (grossMinor: number) => Math.floor((grossMinor * PLATFORM_FEE_PCT) / 100);

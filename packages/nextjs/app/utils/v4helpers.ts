import { encodePacked, keccak256, encodeAbiParameters, parseAbiParameters, type Hex } from "viem";

// V4 Action types
export const Actions = {
  MINT_POSITION: 0,
  INCREASE_LIQUIDITY: 1,
  DECREASE_LIQUIDITY: 2,
  BURN_POSITION: 3,
  SETTLE_PAIR: 16,
  TAKE_PAIR: 17,
  CLOSE_CURRENCY: 19,
  CLEAR_OR_TAKE: 20,
  SWEEP: 21,
} as const;

// Pool addresses
export const POOL_MANAGER = "0x498581ff718922c3f8e6a244956af099b2652b2b" as const;
export const POSITION_MANAGER = "0x7c5f5a4bbd8fd63184577525326123b519429bdc" as const;
export const STATE_VIEW = "0xa3c0c9b65bad0b08107aa264b0f3db444b867a71" as const;
export const PERMIT2 = "0x000000000022D473030F116dDEE9F6B43aC78BA3" as const;
export const CLAWD_TOKEN = "0x9f86dB9fc6f7c9408e8Fda3Ff8ce4e78ac7a6b07" as const;
export const WETH_TOKEN = "0x4200000000000000000000000000000000000006" as const;

// CLAWD > WETH by address, so currency0 = WETH, currency1 = CLAWD
export const CURRENCY0 = WETH_TOKEN; // lower address
export const CURRENCY1 = CLAWD_TOKEN; // higher address

// Pool Key for the main CLAWD/WETH pool
export const POOL_KEY = {
  currency0: CURRENCY0,
  currency1: CURRENCY1,
  fee: 10000, // 1% fee (10000 = 1%)
  tickSpacing: 200,
  hooks: "0x0000000000000000000000000000000000000000" as `0x${string}`,
} as const;

export const POOL_ID = "0x9fd58e73d8047cb14ac540acd141d3fc1a41fb6252d674b730faf62fe24aa8ce" as const;

// Convert sqrtPriceX96 to human-readable price
// sqrtPriceX96 = sqrt(price) * 2^96
// price = (sqrtPriceX96 / 2^96)^2
// This gives price of token1 in terms of token0
export function sqrtPriceX96ToPrice(sqrtPriceX96: bigint, decimals0: number = 18, decimals1: number = 18): number {
  const Q96 = BigInt(2) ** BigInt(96);
  // price = (sqrtPriceX96 / 2^96)^2 * 10^(decimals0 - decimals1)
  const priceNum = Number(sqrtPriceX96) / Number(Q96);
  const price = priceNum * priceNum;
  // Adjust for decimal difference
  const decimalAdjust = Math.pow(10, decimals0 - decimals1);
  return price * decimalAdjust;
}

// Convert tick to price
// price = 1.0001^tick
export function tickToPrice(tick: number): number {
  return Math.pow(1.0001, tick);
}

// Convert price to tick (approximate)
export function priceToTick(price: number): number {
  return Math.round(Math.log(price) / Math.log(1.0001));
}

// Round tick to nearest valid tick based on tickSpacing
export function nearestUsableTick(tick: number, tickSpacing: number): number {
  const rounded = Math.round(tick / tickSpacing) * tickSpacing;
  return rounded;
}

// Encode the pool key tuple
export function encodePoolKey(poolKey: typeof POOL_KEY): Hex {
  return encodeAbiParameters(
    parseAbiParameters("address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks"),
    [poolKey.currency0, poolKey.currency1, poolKey.fee, poolKey.tickSpacing, poolKey.hooks],
  );
}

// Encode actions array
export function encodeActions(actions: number[]): Hex {
  const packedActions = actions.reduce((acc, action, i) => {
    return acc | (BigInt(action) << BigInt(i * 8));
  }, BigInt(0));

  // Pad to 32 bytes
  const hex = packedActions.toString(16).padStart(64, "0");
  return `0x${hex}` as Hex;
}

// Encode MINT_POSITION params
// params: (PoolKey, int24 tickLower, int24 tickUpper, uint256 liquidity, uint128 amount0Max, uint128 amount1Max, address owner, bytes hookData)
export function encodeMintParams(
  poolKey: typeof POOL_KEY,
  tickLower: number,
  tickUpper: number,
  liquidity: bigint,
  amount0Max: bigint,
  amount1Max: bigint,
  owner: `0x${string}`,
  hookData: Hex = "0x",
): Hex {
  return encodeAbiParameters(
    parseAbiParameters(
      "(address,address,uint24,int24,address) poolKey, int24 tickLower, int24 tickUpper, uint256 liquidity, uint128 amount0Max, uint128 amount1Max, address owner, bytes hookData",
    ),
    [
      [poolKey.currency0, poolKey.currency1, poolKey.fee, poolKey.tickSpacing, poolKey.hooks],
      tickLower,
      tickUpper,
      liquidity,
      amount0Max,
      amount1Max,
      owner,
      hookData,
    ],
  );
}

// Encode INCREASE_LIQUIDITY params
// params: (uint256 tokenId, uint256 liquidity, uint128 amount0Max, uint128 amount1Max, bytes hookData)
export function encodeIncreaseLiquidityParams(
  tokenId: bigint,
  liquidity: bigint,
  amount0Max: bigint,
  amount1Max: bigint,
  hookData: Hex = "0x",
): Hex {
  return encodeAbiParameters(
    parseAbiParameters("uint256 tokenId, uint256 liquidity, uint128 amount0Max, uint128 amount1Max, bytes hookData"),
    [tokenId, liquidity, amount0Max, amount1Max, hookData],
  );
}

// Encode DECREASE_LIQUIDITY params
// params: (uint256 tokenId, uint256 liquidity, uint128 amount0Min, uint128 amount1Min, bytes hookData)
export function encodeDecreaseLiquidityParams(
  tokenId: bigint,
  liquidity: bigint,
  amount0Min: bigint,
  amount1Min: bigint,
  hookData: Hex = "0x",
): Hex {
  return encodeAbiParameters(
    parseAbiParameters("uint256 tokenId, uint256 liquidity, uint128 amount0Min, uint128 amount1Min, bytes hookData"),
    [tokenId, liquidity, amount0Min, amount1Min, hookData],
  );
}

// Encode BURN_POSITION params
// params: (uint256 tokenId, uint128 amount0Min, uint128 amount1Min, bytes hookData)
export function encodeBurnPositionParams(
  tokenId: bigint,
  amount0Min: bigint,
  amount1Min: bigint,
  hookData: Hex = "0x",
): Hex {
  return encodeAbiParameters(
    parseAbiParameters("uint256 tokenId, uint128 amount0Min, uint128 amount1Min, bytes hookData"),
    [tokenId, amount0Min, amount1Min, hookData],
  );
}

// Encode SETTLE_PAIR params
// params: (address currency0, address currency1)
export function encodeSettlePairParams(currency0: `0x${string}`, currency1: `0x${string}`): Hex {
  return encodeAbiParameters(parseAbiParameters("address currency0, address currency1"), [currency0, currency1]);
}

// Encode TAKE_PAIR params
// params: (address currency0, address currency1, address recipient)
export function encodeTakePairParams(
  currency0: `0x${string}`,
  currency1: `0x${string}`,
  recipient: `0x${string}`,
): Hex {
  return encodeAbiParameters(parseAbiParameters("address currency0, address currency1, address recipient"), [
    currency0,
    currency1,
    recipient,
  ]);
}

// Encode CLOSE_CURRENCY params
export function encodeCloseCurrencyParams(currency: `0x${string}`): Hex {
  return encodeAbiParameters(parseAbiParameters("address currency"), [currency]);
}

// Encode SWEEP params (currency, recipient)
export function encodeSweepParams(currency: `0x${string}`, recipient: `0x${string}`): Hex {
  return encodeAbiParameters(parseAbiParameters("address currency, address recipient"), [currency, recipient]);
}

// Full encode for modifyLiquidities call
// unlockData = abi.encode(bytes actions, bytes[] params)
export function encodeModifyLiquidities(actions: number[], params: Hex[]): Hex {
  // Actions are packed as bytes
  const actionsBytes = new Uint8Array(actions.length);
  actions.forEach((a, i) => {
    actionsBytes[i] = a;
  });
  const actionsHex = `0x${Array.from(actionsBytes)
    .map(b => b.toString(16).padStart(2, "0"))
    .join("")}` as Hex;

  return encodeAbiParameters(parseAbiParameters("bytes actions, bytes[] params"), [actionsHex, params]);
}

// Calculate liquidity from amounts and tick range
// For a concentrated liquidity position:
// liquidity = min(amount0 * sqrtP_upper * sqrtP_lower / (sqrtP_upper - sqrtP_lower), amount1 / (sqrtP_upper - sqrtP_lower))
export function calculateLiquidityFromAmounts(
  sqrtPriceX96: bigint,
  tickLower: number,
  tickUpper: number,
  amount0: bigint,
  amount1: bigint,
): bigint {
  const Q96 = BigInt(2) ** BigInt(96);

  const sqrtPriceLowerX96 = tickToSqrtPriceX96(tickLower);
  const sqrtPriceUpperX96 = tickToSqrtPriceX96(tickUpper);

  let liquidity: bigint;

  if (sqrtPriceX96 <= sqrtPriceLowerX96) {
    // Current price below range — only token0 needed
    liquidity = getLiquidityForAmount0(sqrtPriceLowerX96, sqrtPriceUpperX96, amount0);
  } else if (sqrtPriceX96 < sqrtPriceUpperX96) {
    // Current price in range — both tokens needed
    const liq0 = getLiquidityForAmount0(sqrtPriceX96, sqrtPriceUpperX96, amount0);
    const liq1 = getLiquidityForAmount1(sqrtPriceLowerX96, sqrtPriceX96, amount1);
    liquidity = liq0 < liq1 ? liq0 : liq1;
  } else {
    // Current price above range — only token1 needed
    liquidity = getLiquidityForAmount1(sqrtPriceLowerX96, sqrtPriceUpperX96, amount1);
  }

  return liquidity;
}

function getLiquidityForAmount0(sqrtPriceAX96: bigint, sqrtPriceBX96: bigint, amount0: bigint): bigint {
  const Q96 = BigInt(2) ** BigInt(96);
  if (sqrtPriceAX96 > sqrtPriceBX96) [sqrtPriceAX96, sqrtPriceBX96] = [sqrtPriceBX96, sqrtPriceAX96];
  return (amount0 * sqrtPriceAX96 * sqrtPriceBX96) / (Q96 * (sqrtPriceBX96 - sqrtPriceAX96));
}

function getLiquidityForAmount1(sqrtPriceAX96: bigint, sqrtPriceBX96: bigint, amount1: bigint): bigint {
  const Q96 = BigInt(2) ** BigInt(96);
  if (sqrtPriceAX96 > sqrtPriceBX96) [sqrtPriceAX96, sqrtPriceBX96] = [sqrtPriceBX96, sqrtPriceAX96];
  return (amount1 * Q96) / (sqrtPriceBX96 - sqrtPriceAX96);
}

// Convert tick to sqrtPriceX96
export function tickToSqrtPriceX96(tick: number): bigint {
  const Q96 = BigInt(2) ** BigInt(96);
  // sqrtPrice = sqrt(1.0001^tick)
  const sqrtPrice = Math.sqrt(Math.pow(1.0001, tick));
  return BigInt(Math.floor(sqrtPrice * Number(Q96)));
}

// Calculate amounts from liquidity and tick range
export function getAmountsFromLiquidity(
  sqrtPriceX96: bigint,
  tickLower: number,
  tickUpper: number,
  liquidity: bigint,
): { amount0: bigint; amount1: bigint } {
  const Q96 = BigInt(2) ** BigInt(96);
  const sqrtPriceLowerX96 = tickToSqrtPriceX96(tickLower);
  const sqrtPriceUpperX96 = tickToSqrtPriceX96(tickUpper);

  let amount0 = BigInt(0);
  let amount1 = BigInt(0);

  if (sqrtPriceX96 <= sqrtPriceLowerX96) {
    amount0 = getAmount0ForLiquidity(sqrtPriceLowerX96, sqrtPriceUpperX96, liquidity);
  } else if (sqrtPriceX96 < sqrtPriceUpperX96) {
    amount0 = getAmount0ForLiquidity(sqrtPriceX96, sqrtPriceUpperX96, liquidity);
    amount1 = getAmount1ForLiquidity(sqrtPriceLowerX96, sqrtPriceX96, liquidity);
  } else {
    amount1 = getAmount1ForLiquidity(sqrtPriceLowerX96, sqrtPriceUpperX96, liquidity);
  }

  return { amount0, amount1 };
}

function getAmount0ForLiquidity(sqrtPriceAX96: bigint, sqrtPriceBX96: bigint, liquidity: bigint): bigint {
  const Q96 = BigInt(2) ** BigInt(96);
  if (sqrtPriceAX96 > sqrtPriceBX96) [sqrtPriceAX96, sqrtPriceBX96] = [sqrtPriceBX96, sqrtPriceAX96];
  return (liquidity * Q96 * (sqrtPriceBX96 - sqrtPriceAX96)) / (sqrtPriceBX96 * sqrtPriceAX96);
}

function getAmount1ForLiquidity(sqrtPriceAX96: bigint, sqrtPriceBX96: bigint, liquidity: bigint): bigint {
  const Q96 = BigInt(2) ** BigInt(96);
  if (sqrtPriceAX96 > sqrtPriceBX96) [sqrtPriceAX96, sqrtPriceBX96] = [sqrtPriceBX96, sqrtPriceAX96];
  return (liquidity * (sqrtPriceBX96 - sqrtPriceAX96)) / Q96;
}

// Decode positionInfo packed uint256 to get tickLower, tickUpper, hasSubscriber
export function decodePositionInfo(info: bigint): { tickLower: number; tickUpper: number; hasSubscriber: boolean } {
  // PositionInfo is packed as:
  // [0:23] hasSubscriber (1 bit, but stored in low byte area)
  // Actually V4 PositionInfo packing:
  // tickLower: int24 at bits [0:24]
  // tickUpper: int24 at bits [24:48]
  // hasSubscriber: bool at bit 48
  // poolId portion may be elsewhere
  // Let me check the actual packing...

  // From v4-periphery PositionInfoLibrary:
  // PositionInfo is a uint256 that packs:
  // [0:24] poolId truncated (but we don't need it)
  // Actually the packing is:
  // bytes25 poolId | int24 tickUpper | int24 tickLower | bool hasSubscriber
  // That's from most significant to least significant

  // hasSubscriber is the lowest bit
  const hasSubscriber = (info & BigInt(1)) !== BigInt(0);

  // tickLower is next 24 bits (bits 1-24)
  let tickLowerRaw = Number((info >> BigInt(1)) & BigInt(0xFFFFFF));
  // Sign extend from 24 bits
  if (tickLowerRaw >= 0x800000) tickLowerRaw -= 0x1000000;

  // tickUpper is next 24 bits (bits 25-48)
  let tickUpperRaw = Number((info >> BigInt(25)) & BigInt(0xFFFFFF));
  if (tickUpperRaw >= 0x800000) tickUpperRaw -= 0x1000000;

  return { tickLower: tickLowerRaw, tickUpper: tickUpperRaw, hasSubscriber };
}

// Format a number with commas
export function formatNumber(num: number, decimals: number = 2): string {
  return num.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

// Format token amount from raw bigint
export function formatTokenAmount(raw: bigint, decimals: number = 18, displayDecimals: number = 4): string {
  const divisor = BigInt(10) ** BigInt(decimals);
  const whole = raw / divisor;
  const frac = raw % divisor;
  const fracStr = frac.toString().padStart(decimals, "0").slice(0, displayDecimals);
  return `${whole.toLocaleString()}.${fracStr}`;
}

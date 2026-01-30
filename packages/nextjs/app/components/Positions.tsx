"use client";

import { useEffect, useState } from "react";
import { formatEther, formatUnits, encodeAbiParameters, parseAbiParameters, maxUint128, type Hex } from "viem";
import { useAccount, useReadContract, useWriteContract, usePublicClient } from "wagmi";
import {
  POOL_ID,
  POSITION_MANAGER,
  POOL_KEY,
  CURRENCY0,
  CURRENCY1,
  Actions,
  encodeModifyLiquidities,
  encodeDecreaseLiquidityParams,
  encodeBurnPositionParams,
  encodeCloseCurrencyParams,
  encodeSweepParams,
  encodeTakePairParams,
  tickToPrice,
  formatNumber,
  getAmountsFromLiquidity,
  sqrtPriceX96ToPrice,
} from "../utils/v4helpers";

const STATE_VIEW = "0xa3c0c9b65bad0b08107aa264b0f3db444b867a71" as const;

const positionManagerAbi = [
  {
    inputs: [{ name: "owner", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "owner", type: "address" }, { name: "index", type: "uint256" }],
    name: "tokenOfOwnerByIndex",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "tokenId", type: "uint256" }],
    name: "getPositionLiquidity",
    outputs: [{ name: "liquidity", type: "uint128" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "tokenId", type: "uint256" }],
    name: "getPoolAndPositionInfo",
    outputs: [
      {
        components: [
          { name: "currency0", type: "address" },
          { name: "currency1", type: "address" },
          { name: "fee", type: "uint24" },
          { name: "tickSpacing", type: "int24" },
          { name: "hooks", type: "address" },
        ],
        name: "poolKey",
        type: "tuple",
      },
      { name: "info", type: "uint256" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "unlockData", type: "bytes" }, { name: "deadline", type: "uint256" }],
    name: "modifyLiquidities",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
] as const;

const stateViewAbi = [
  {
    inputs: [{ name: "poolId", type: "bytes32" }],
    name: "getSlot0",
    outputs: [
      { name: "sqrtPriceX96", type: "uint160" },
      { name: "tick", type: "int24" },
      { name: "protocolFee", type: "uint24" },
      { name: "lpFee", type: "uint24" },
    ],
    stateMutability: "view",
    type: "function",
  },
] as const;

interface PositionData {
  tokenId: bigint;
  liquidity: bigint;
  tickLower: number;
  tickUpper: number;
  poolKey: {
    currency0: string;
    currency1: string;
    fee: number;
    tickSpacing: number;
    hooks: string;
  };
  amount0: bigint;
  amount1: bigint;
}

interface PositionsProps {
  ethPrice: number;
  clawdPrice: number;
}

export function Positions({ ethPrice, clawdPrice }: PositionsProps) {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const [positions, setPositions] = useState<PositionData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [removingId, setRemovingId] = useState<bigint | null>(null);
  const [removePercent, setRemovePercent] = useState<Record<string, number>>({});
  const [txHash, setTxHash] = useState<string>("");
  const [error, setError] = useState<string>("");

  // Read current sqrtPrice
  const { data: slot0Data } = useReadContract({
    address: STATE_VIEW,
    abi: stateViewAbi,
    functionName: "getSlot0",
    args: [POOL_ID],
  });

  const sqrtPriceX96 = slot0Data?.[0] ?? BigInt(0);
  const currentTick = slot0Data?.[1] ?? 0;

  // Read position count
  const { data: balanceOf } = useReadContract({
    address: POSITION_MANAGER,
    abi: positionManagerAbi,
    functionName: "balanceOf",
    args: [address ?? "0x0000000000000000000000000000000000000000"],
    query: { enabled: !!address },
  });

  // Fetch all positions
  useEffect(() => {
    if (!address || !publicClient || !balanceOf || balanceOf === BigInt(0)) {
      setPositions([]);
      return;
    }

    const fetchPositions = async () => {
      setIsLoading(true);
      try {
        const count = Number(balanceOf);
        const positionsList: PositionData[] = [];

        for (let i = 0; i < Math.min(count, 20); i++) {
          try {
            // Get tokenId
            const tokenId = await publicClient.readContract({
              address: POSITION_MANAGER,
              abi: positionManagerAbi,
              functionName: "tokenOfOwnerByIndex",
              args: [address, BigInt(i)],
            });

            // Get position info
            const [poolKey, info] = await publicClient.readContract({
              address: POSITION_MANAGER,
              abi: positionManagerAbi,
              functionName: "getPoolAndPositionInfo",
              args: [tokenId],
            }) as [any, bigint];

            // Check if this is our CLAWD pool
            const c0 = (poolKey.currency0 as string).toLowerCase();
            const c1 = (poolKey.currency1 as string).toLowerCase();
            const isClawdPool =
              (c0 === CURRENCY0.toLowerCase() && c1 === CURRENCY1.toLowerCase()) ||
              (c0 === CURRENCY1.toLowerCase() && c1 === CURRENCY0.toLowerCase());

            if (!isClawdPool) continue;

            // Get liquidity
            const liquidity = await publicClient.readContract({
              address: POSITION_MANAGER,
              abi: positionManagerAbi,
              functionName: "getPositionLiquidity",
              args: [tokenId],
            });

            // Decode positionInfo to get tick range
            // PositionInfo packing from V4:
            // hasSubscriber (1 bit) | tickLower (24 bits) | tickUpper (24 bits) | poolId (200 bits from MSB)
            // Actually it's packed differently. Let me decode carefully.
            // From the source: the info is packed as:
            // poolId (25 bytes = 200 bits) at MSB | tickUpper (3 bytes) | tickLower (3 bytes) | hasSubscriber (1 byte)
            // Total = 25 + 3 + 3 + 1 = 32 bytes

            const hasSubscriber = (info & BigInt(0xFF)) !== BigInt(0);
            let tickLowerRaw = Number((info >> BigInt(8)) & BigInt(0xFFFFFF));
            if (tickLowerRaw >= 0x800000) tickLowerRaw -= 0x1000000;
            let tickUpperRaw = Number((info >> BigInt(32)) & BigInt(0xFFFFFF));
            if (tickUpperRaw >= 0x800000) tickUpperRaw -= 0x1000000;

            // Calculate amounts from liquidity
            const amounts = sqrtPriceX96 > BigInt(0)
              ? getAmountsFromLiquidity(sqrtPriceX96, tickLowerRaw, tickUpperRaw, liquidity)
              : { amount0: BigInt(0), amount1: BigInt(0) };

            positionsList.push({
              tokenId,
              liquidity,
              tickLower: tickLowerRaw,
              tickUpper: tickUpperRaw,
              poolKey: {
                currency0: poolKey.currency0,
                currency1: poolKey.currency1,
                fee: Number(poolKey.fee),
                tickSpacing: Number(poolKey.tickSpacing),
                hooks: poolKey.hooks,
              },
              amount0: amounts.amount0,
              amount1: amounts.amount1,
            });
          } catch (e) {
            console.error(`Error fetching position ${i}:`, e);
          }
        }

        setPositions(positionsList);
      } catch (e) {
        console.error("Error fetching positions:", e);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPositions();
  }, [address, publicClient, balanceOf, sqrtPriceX96]);

  // Remove liquidity handler
  const handleRemoveLiquidity = async (position: PositionData) => {
    if (!address) return;
    const percent = removePercent[position.tokenId.toString()] || 100;
    setRemovingId(position.tokenId);
    setError("");
    setTxHash("");

    try {
      const liquidityToRemove = (position.liquidity * BigInt(percent)) / BigInt(100);

      if (percent === 100) {
        // Full removal — DECREASE then BURN
        const decreaseParams = encodeDecreaseLiquidityParams(
          position.tokenId,
          position.liquidity,
          BigInt(0), // amount0Min
          BigInt(0), // amount1Min
        );
        const burnParams = encodeBurnPositionParams(
          position.tokenId,
          BigInt(0),
          BigInt(0),
        );
        const takePairParams = encodeTakePairParams(CURRENCY0, CURRENCY1, address as `0x${string}`);

        const actions = [
          Actions.DECREASE_LIQUIDITY,
          Actions.TAKE_PAIR,
          Actions.BURN_POSITION,
        ];
        const params = [decreaseParams, takePairParams, burnParams];
        const unlockData = encodeModifyLiquidities(actions, params);

        const deadline = BigInt(Math.floor(Date.now() / 1000) + 1800);
        const hash = await writeContractAsync({
          address: POSITION_MANAGER,
          abi: positionManagerAbi,
          functionName: "modifyLiquidities",
          args: [unlockData, deadline],
        });
        setTxHash(hash);
      } else {
        // Partial removal
        const decreaseParams = encodeDecreaseLiquidityParams(
          position.tokenId,
          liquidityToRemove,
          BigInt(0),
          BigInt(0),
        );
        const takePairParams = encodeTakePairParams(CURRENCY0, CURRENCY1, address as `0x${string}`);

        const actions = [Actions.DECREASE_LIQUIDITY, Actions.TAKE_PAIR];
        const params = [decreaseParams, takePairParams];
        const unlockData = encodeModifyLiquidities(actions, params);

        const deadline = BigInt(Math.floor(Date.now() / 1000) + 1800);
        const hash = await writeContractAsync({
          address: POSITION_MANAGER,
          abi: positionManagerAbi,
          functionName: "modifyLiquidities",
          args: [unlockData, deadline],
        });
        setTxHash(hash);
      }
    } catch (e: any) {
      console.error("Remove error:", e);
      setError(e.shortMessage || e.message || "Remove failed");
    } finally {
      setRemovingId(null);
    }
  };

  if (!address) {
    return (
      <div className="bg-base-200 rounded-2xl p-6 shadow-lg">
        <h2 className="text-xl font-bold mb-4">📋 Your Positions</h2>
        <div className="text-center text-base-content/60 py-8">Connect your wallet to view positions</div>
      </div>
    );
  }

  return (
    <div className="bg-base-200 rounded-2xl p-6 shadow-lg">
      <h2 className="text-xl font-bold mb-4">
        📋 Your Positions
        {balanceOf !== undefined && (
          <span className="badge badge-ghost ml-2">{Number(balanceOf)} total V4 NFTs</span>
        )}
      </h2>

      {error && (
        <div className="alert alert-error text-sm mb-4">
          <span>{error}</span>
        </div>
      )}

      {txHash && (
        <div className="alert alert-success text-sm mb-4">
          <span>
            ✅ Transaction sent!{" "}
            <a
              href={`https://basescan.org/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="link"
            >
              View on Basescan →
            </a>
          </span>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-8">
          <span className="loading loading-spinner loading-lg"></span>
          <p className="mt-2 text-base-content/60">Loading positions...</p>
        </div>
      ) : positions.length === 0 ? (
        <div className="text-center text-base-content/60 py-8">
          No CLAWD/WETH positions found. Add liquidity above! 🦞
        </div>
      ) : (
        <div className="space-y-4">
          {positions.map((pos) => {
            const ethValue = parseFloat(formatEther(pos.amount0));
            const clawdValue = parseFloat(formatUnits(pos.amount1, 18));
            const totalUsd = ethValue * ethPrice + clawdValue * clawdPrice;
            const inRange = currentTick >= pos.tickLower && currentTick < pos.tickUpper;
            const pct = removePercent[pos.tokenId.toString()] || 100;

            return (
              <div key={pos.tokenId.toString()} className="bg-base-100 rounded-xl p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm">#{pos.tokenId.toString()}</span>
                      <span className={`badge badge-sm ${inRange ? "badge-success" : "badge-warning"}`}>
                        {inRange ? "In Range" : "Out of Range"}
                      </span>
                    </div>
                    <div className="text-sm mt-1 text-base-content/70">
                      Tick: [{pos.tickLower}, {pos.tickUpper}]
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold">${formatNumber(totalUsd, 2)}</div>
                    <div className="text-xs text-base-content/60">Total value</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-3 text-sm">
                  <div className="bg-base-200 rounded-lg p-2">
                    <div className="text-xs text-base-content/60">WETH</div>
                    <div className="font-mono">{formatNumber(ethValue, 6)}</div>
                    <div className="text-xs text-info">${formatNumber(ethValue * ethPrice, 2)}</div>
                  </div>
                  <div className="bg-base-200 rounded-lg p-2">
                    <div className="text-xs text-base-content/60">🦞 CLAWD</div>
                    <div className="font-mono">{formatNumber(clawdValue, 0)}</div>
                    <div className="text-xs text-info">${formatNumber(clawdValue * clawdPrice, 2)}</div>
                  </div>
                </div>

                {/* Remove controls */}
                <div className="mt-3 flex items-center gap-2">
                  <input
                    type="range"
                    min="1"
                    max="100"
                    value={pct}
                    onChange={(e) =>
                      setRemovePercent({ ...removePercent, [pos.tokenId.toString()]: parseInt(e.target.value) })
                    }
                    className="range range-sm range-error flex-1"
                  />
                  <span className="text-sm font-bold w-12 text-right">{pct}%</span>
                  <button
                    className="btn btn-error btn-sm"
                    onClick={() => handleRemoveLiquidity(pos)}
                    disabled={removingId === pos.tokenId}
                  >
                    {removingId === pos.tokenId ? (
                      <><span className="loading loading-spinner loading-xs"></span> Removing...</>
                    ) : pct === 100 ? (
                      "Remove All"
                    ) : (
                      `Remove ${pct}%`
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

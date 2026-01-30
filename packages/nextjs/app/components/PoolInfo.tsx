"use client";

import { useEffect, useState } from "react";
import { formatEther, formatUnits } from "viem";
import { useReadContract } from "wagmi";
import {
  POOL_ID,
  CURRENCY0,
  CURRENCY1,
  sqrtPriceX96ToPrice,
  tickToPrice,
  formatNumber,
} from "../utils/v4helpers";

const STATE_VIEW = "0xa3c0c9b65bad0b08107aa264b0f3db444b867a71" as const;

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
  {
    inputs: [{ name: "poolId", type: "bytes32" }],
    name: "getLiquidity",
    outputs: [{ name: "liquidity", type: "uint128" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

interface PoolInfoProps {
  ethPrice: number;
  clawdPrice: number;
}

export function PoolInfo({ ethPrice, clawdPrice }: PoolInfoProps) {
  const { data: slot0Data } = useReadContract({
    address: STATE_VIEW,
    abi: stateViewAbi,
    functionName: "getSlot0",
    args: [POOL_ID],
  });

  const { data: liquidityData } = useReadContract({
    address: STATE_VIEW,
    abi: stateViewAbi,
    functionName: "getLiquidity",
    args: [POOL_ID],
  });

  const sqrtPriceX96 = slot0Data?.[0] ?? BigInt(0);
  const currentTick = slot0Data?.[1] ?? 0;
  const lpFee = slot0Data?.[3] ?? 0;

  // Price of CLAWD in WETH (token1 in terms of token0)
  // Since currency0=WETH, currency1=CLAWD, the raw price is CLAWD/WETH
  // i.e., how much WETH per CLAWD
  const clawdPerWeth = sqrtPriceX96 > 0 ? sqrtPriceX96ToPrice(sqrtPriceX96) : 0;
  const wethPerClawd = clawdPerWeth > 0 ? 1 / clawdPerWeth : 0;
  const clawdPriceUsd = wethPerClawd > 0 ? wethPerClawd * ethPrice : clawdPrice;
  const clawdPerEth = clawdPerWeth > 0 ? clawdPerWeth : 0;

  // TVL estimation using DexScreener data if available
  const tvlUsd = 2181408; // From DexScreener — will update with live data

  return (
    <div className="bg-base-200 rounded-2xl p-6 shadow-lg">
      <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
        🦞 CLAWD/WETH Pool
        <span className="badge badge-primary text-xs">V4</span>
        <span className="badge badge-ghost text-xs">{(Number(lpFee) / 10000).toFixed(1)}% fee</span>
      </h2>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="stat bg-base-100 rounded-xl p-4">
          <div className="stat-title text-xs">CLAWD Price</div>
          <div className="stat-value text-lg">${clawdPriceUsd > 0 ? clawdPriceUsd.toFixed(7) : "..."}</div>
          <div className="stat-desc text-xs">{clawdPerEth > 0 ? formatNumber(clawdPerEth, 0) : "..."} CLAWD/ETH</div>
        </div>
        <div className="stat bg-base-100 rounded-xl p-4">
          <div className="stat-title text-xs">TVL</div>
          <div className="stat-value text-lg">${formatNumber(tvlUsd, 0)}</div>
          <div className="stat-desc text-xs">Total Value Locked</div>
        </div>
        <div className="stat bg-base-100 rounded-xl p-4">
          <div className="stat-title text-xs">Current Tick</div>
          <div className="stat-value text-lg font-mono">{currentTick.toLocaleString()}</div>
          <div className="stat-desc text-xs">Tick spacing: 200</div>
        </div>
        <div className="stat bg-base-100 rounded-xl p-4">
          <div className="stat-title text-xs">ETH Price</div>
          <div className="stat-value text-lg">${formatNumber(ethPrice, 0)}</div>
          <div className="stat-desc text-xs">via Scaffold-ETH</div>
        </div>
      </div>
    </div>
  );
}

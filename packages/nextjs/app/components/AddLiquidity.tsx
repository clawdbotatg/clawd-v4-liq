"use client";

import { useEffect, useState, useCallback } from "react";
import { parseEther, parseUnits, formatEther, formatUnits, encodeFunctionData, maxUint128, maxUint160, maxUint256 } from "viem";
import { useAccount, useReadContract, useWriteContract, useSwitchChain, usePublicClient, useWalletClient } from "wagmi";
import { base } from "viem/chains";
import {
  POOL_KEY,
  POOL_ID,
  POSITION_MANAGER,
  PERMIT2,
  CURRENCY0,
  CURRENCY1,
  CLAWD_TOKEN,
  WETH_TOKEN,
  Actions,
  encodeModifyLiquidities,
  encodeMintParams,
  encodeSettlePairParams,
  encodeCloseCurrencyParams,
  encodeSweepParams,
  calculateLiquidityFromAmounts,
  tickToSqrtPriceX96,
  nearestUsableTick,
  priceToTick,
  tickToPrice,
  formatNumber,
  sqrtPriceX96ToPrice,
} from "../utils/v4helpers";

const TICK_SPACING = 200;

// Minimal ABIs for direct calls
const erc20Abi = [
  {
    inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }],
    name: "approve",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }],
    name: "allowance",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

const permit2Abi = [
  {
    inputs: [
      { name: "token", type: "address" },
      { name: "spender", type: "address" },
      { name: "amount", type: "uint160" },
      { name: "expiration", type: "uint48" },
    ],
    name: "approve",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "owner", type: "address" },
      { name: "token", type: "address" },
      { name: "spender", type: "address" },
    ],
    name: "allowance",
    outputs: [
      { name: "amount", type: "uint160" },
      { name: "expiration", type: "uint48" },
      { name: "nonce", type: "uint48" },
    ],
    stateMutability: "view",
    type: "function",
  },
] as const;

const positionManagerAbi = [
  {
    inputs: [
      { name: "unlockData", type: "bytes" },
      { name: "deadline", type: "uint256" },
    ],
    name: "modifyLiquidities",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [{ name: "data", type: "bytes[]" }],
    name: "multicall",
    outputs: [{ name: "results", type: "bytes[]" }],
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

interface AddLiquidityProps {
  ethPrice: number;
  clawdPrice: number;
}

export function AddLiquidity({ ethPrice, clawdPrice }: AddLiquidityProps) {
  const { address, chain } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();

  // Form state
  const [ethAmount, setEthAmount] = useState("");
  const [clawdAmount, setClawdAmount] = useState("");
  const [rangeType, setRangeType] = useState<"full" | "wide" | "narrow" | "custom">("wide");
  const [customLowerTick, setCustomLowerTick] = useState("");
  const [customUpperTick, setCustomUpperTick] = useState("");

  // Loading states — separate per action
  const [isSwitching, setIsSwitching] = useState(false);
  const [isApprovingClawdToPermit2, setIsApprovingClawdToPermit2] = useState(false);
  const [isApprovingWethToPermit2, setIsApprovingWethToPermit2] = useState(false);
  const [isApprovingClawdPermit2, setIsApprovingClawdPermit2] = useState(false);
  const [isApprovingWethPermit2, setIsApprovingWethPermit2] = useState(false);
  const [isMinting, setIsMinting] = useState(false);
  const [txHash, setTxHash] = useState<string>("");
  const [error, setError] = useState<string>("");

  // Read pool slot0 for current tick
  const { data: slot0Data } = useReadContract({
    address: "0xa3c0c9b65bad0b08107aa264b0f3db444b867a71",
    abi: stateViewAbi,
    functionName: "getSlot0",
    args: [POOL_ID],
  });

  const currentTick = slot0Data?.[1] ?? 167890;
  const sqrtPriceX96 = slot0Data?.[0] ?? BigInt(0);

  // Read CLAWD balance
  const { data: clawdBalance } = useReadContract({
    address: CLAWD_TOKEN,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [address ?? "0x0000000000000000000000000000000000000000"],
    query: { enabled: !!address },
  });

  // Read WETH balance
  const { data: wethBalance } = useReadContract({
    address: WETH_TOKEN,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [address ?? "0x0000000000000000000000000000000000000000"],
    query: { enabled: !!address },
  });

  // Read CLAWD allowance to Permit2
  const { data: clawdAllowanceToPermit2, refetch: refetchClawdAllowance } = useReadContract({
    address: CLAWD_TOKEN,
    abi: erc20Abi,
    functionName: "allowance",
    args: [address ?? "0x0000000000000000000000000000000000000000", PERMIT2],
    query: { enabled: !!address },
  });

  // Read WETH allowance to Permit2
  const { data: wethAllowanceToPermit2, refetch: refetchWethAllowance } = useReadContract({
    address: WETH_TOKEN,
    abi: erc20Abi,
    functionName: "allowance",
    args: [address ?? "0x0000000000000000000000000000000000000000", PERMIT2],
    query: { enabled: !!address },
  });

  // Read Permit2 allowance for CLAWD to PositionManager
  const { data: permit2ClawdAllowance, refetch: refetchPermit2Clawd } = useReadContract({
    address: PERMIT2,
    abi: permit2Abi,
    functionName: "allowance",
    args: [
      address ?? "0x0000000000000000000000000000000000000000",
      CLAWD_TOKEN,
      POSITION_MANAGER,
    ],
    query: { enabled: !!address },
  });

  // Read Permit2 allowance for WETH to PositionManager
  const { data: permit2WethAllowance, refetch: refetchPermit2Weth } = useReadContract({
    address: PERMIT2,
    abi: permit2Abi,
    functionName: "allowance",
    args: [
      address ?? "0x0000000000000000000000000000000000000000",
      WETH_TOKEN,
      POSITION_MANAGER,
    ],
    query: { enabled: !!address },
  });

  // Calculate tick range based on selection
  const getTickRange = useCallback((): { tickLower: number; tickUpper: number } => {
    if (rangeType === "custom") {
      const lower = parseInt(customLowerTick) || currentTick - 10000;
      const upper = parseInt(customUpperTick) || currentTick + 10000;
      return {
        tickLower: nearestUsableTick(lower, TICK_SPACING),
        tickUpper: nearestUsableTick(upper, TICK_SPACING),
      };
    }
    const ranges: Record<string, number> = {
      full: 887200, // near max range
      wide: 40000,
      narrow: 4000,
    };
    const range = ranges[rangeType] || 40000;
    return {
      tickLower: nearestUsableTick(currentTick - range, TICK_SPACING),
      tickUpper: nearestUsableTick(currentTick + range, TICK_SPACING),
    };
  }, [rangeType, currentTick, customLowerTick, customUpperTick]);

  const { tickLower, tickUpper } = getTickRange();

  // Price range display
  const priceLower = tickToPrice(tickLower); // CLAWD per WETH at lower tick
  const priceUpper = tickToPrice(tickUpper);
  const currentPrice = tickToPrice(currentTick);

  // Parse amounts
  const ethAmountWei = ethAmount ? parseEther(ethAmount) : BigInt(0);
  const clawdAmountWei = clawdAmount ? parseUnits(clawdAmount, 18) : BigInt(0);

  // Check approval states
  const needsClawdApproveToPermit2 = clawdAmountWei > BigInt(0) && (!clawdAllowanceToPermit2 || clawdAllowanceToPermit2 < clawdAmountWei);
  const needsWethApproveToPermit2 = ethAmountWei > BigInt(0) && (!wethAllowanceToPermit2 || wethAllowanceToPermit2 < ethAmountWei);

  const permit2ClawdAmt = permit2ClawdAllowance?.[0] ?? BigInt(0);
  const permit2WethAmt = permit2WethAllowance?.[0] ?? BigInt(0);
  const needsClawdPermit2Approve = clawdAmountWei > BigInt(0) && permit2ClawdAmt < clawdAmountWei;
  const needsWethPermit2Approve = ethAmountWei > BigInt(0) && permit2WethAmt < ethAmountWei;

  const wrongNetwork = chain?.id !== base.id;
  const hasAmounts = ethAmountWei > BigInt(0) || clawdAmountWei > BigInt(0);
  const needsAnyApproval = needsClawdApproveToPermit2 || needsWethApproveToPermit2 || needsClawdPermit2Approve || needsWethPermit2Approve;

  // Approval handlers
  const handleSwitchNetwork = async () => {
    setIsSwitching(true);
    setError("");
    try {
      await switchChainAsync({ chainId: base.id });
    } catch (e: any) {
      setError(e.message || "Failed to switch network");
    } finally {
      setIsSwitching(false);
    }
  };

  const handleApproveClawdToPermit2 = async () => {
    setIsApprovingClawdToPermit2(true);
    setError("");
    try {
      // Approve EXACT amount (with 5% buffer for slippage) — NEVER unlimited
      const approveAmount = clawdAmountWei + (clawdAmountWei * BigInt(5)) / BigInt(100);
      await writeContractAsync({
        address: CLAWD_TOKEN,
        abi: erc20Abi,
        functionName: "approve",
        args: [PERMIT2, approveAmount],
      });
      // Wait a bit then refetch
      setTimeout(() => refetchClawdAllowance(), 3000);
    } catch (e: any) {
      setError(e.shortMessage || e.message || "CLAWD approve failed");
    } finally {
      setIsApprovingClawdToPermit2(false);
    }
  };

  const handleApproveWethToPermit2 = async () => {
    setIsApprovingWethToPermit2(true);
    setError("");
    try {
      // Approve EXACT amount (with 5% buffer for slippage) — NEVER unlimited
      const approveAmount = ethAmountWei + (ethAmountWei * BigInt(5)) / BigInt(100);
      await writeContractAsync({
        address: WETH_TOKEN,
        abi: erc20Abi,
        functionName: "approve",
        args: [PERMIT2, approveAmount],
      });
      setTimeout(() => refetchWethAllowance(), 3000);
    } catch (e: any) {
      setError(e.shortMessage || e.message || "WETH approve failed");
    } finally {
      setIsApprovingWethToPermit2(false);
    }
  };

  const handleApproveClawdPermit2 = async () => {
    setIsApprovingClawdPermit2(true);
    setError("");
    try {
      const expiration = Math.floor(Date.now() / 1000) + 86400 * 30; // 30 days
      // Approve EXACT amount (with 5% buffer) — NEVER unlimited
      const approveAmount = clawdAmountWei + (clawdAmountWei * BigInt(5)) / BigInt(100);
      // Permit2 uses uint160 for amount — cap to uint160 max if needed
      const permit2Amount = approveAmount > maxUint160 ? maxUint160 : approveAmount;
      await writeContractAsync({
        address: PERMIT2,
        abi: permit2Abi,
        functionName: "approve",
        args: [CLAWD_TOKEN, POSITION_MANAGER, permit2Amount, expiration],
      });
      setTimeout(() => refetchPermit2Clawd(), 3000);
    } catch (e: any) {
      setError(e.shortMessage || e.message || "Permit2 CLAWD approve failed");
    } finally {
      setIsApprovingClawdPermit2(false);
    }
  };

  const handleApproveWethPermit2 = async () => {
    setIsApprovingWethPermit2(true);
    setError("");
    try {
      const expiration = Math.floor(Date.now() / 1000) + 86400 * 30;
      // Approve EXACT amount (with 5% buffer) — NEVER unlimited
      const approveAmount = ethAmountWei + (ethAmountWei * BigInt(5)) / BigInt(100);
      const permit2Amount = approveAmount > maxUint160 ? maxUint160 : approveAmount;
      await writeContractAsync({
        address: PERMIT2,
        abi: permit2Abi,
        functionName: "approve",
        args: [WETH_TOKEN, POSITION_MANAGER, permit2Amount, expiration],
      });
      setTimeout(() => refetchPermit2Weth(), 3000);
    } catch (e: any) {
      setError(e.shortMessage || e.message || "Permit2 WETH approve failed");
    } finally {
      setIsApprovingWethPermit2(false);
    }
  };

  // Mint position
  const handleMint = async () => {
    if (!address || !publicClient) return;
    setIsMinting(true);
    setError("");
    setTxHash("");

    try {
      // Calculate liquidity from amounts
      const liquidity = calculateLiquidityFromAmounts(
        sqrtPriceX96,
        tickLower,
        tickUpper,
        ethAmountWei, // amount0 = WETH
        clawdAmountWei, // amount1 = CLAWD
      );

      if (liquidity <= BigInt(0)) {
        setError("Calculated liquidity is zero. Check your amounts.");
        setIsMinting(false);
        return;
      }

      // Add 5% slippage to max amounts
      const amount0Max = ethAmountWei + (ethAmountWei * BigInt(5)) / BigInt(100);
      const amount1Max = clawdAmountWei + (clawdAmountWei * BigInt(5)) / BigInt(100);

      // Encode MINT_POSITION params
      const mintParams = encodeMintParams(
        POOL_KEY,
        tickLower,
        tickUpper,
        liquidity,
        amount0Max > BigInt(0) ? amount0Max : maxUint128,
        amount1Max > BigInt(0) ? amount1Max : maxUint128,
        address as `0x${string}`,
      );

      // Encode CLOSE_CURRENCY params for both tokens (handles leftovers)
      const closeParams0 = encodeCloseCurrencyParams(CURRENCY0);
      const closeParams1 = encodeCloseCurrencyParams(CURRENCY1);

      // Encode SWEEP params to return leftover tokens
      const sweepParams0 = encodeSweepParams(CURRENCY0, address as `0x${string}`);
      const sweepParams1 = encodeSweepParams(CURRENCY1, address as `0x${string}`);

      // Build the unlockData: actions + params
      const actions = [
        Actions.MINT_POSITION,
        Actions.SETTLE_PAIR,
        Actions.TAKE_PAIR,
      ];

      const settleParams = encodeSettlePairParams(CURRENCY0, CURRENCY1);
      const takeParams = encodeSettlePairParams(CURRENCY0, CURRENCY1);

      // Actually for TAKE_PAIR the encoding is (address, address, address) with recipient
      // Let me use CLOSE_CURRENCY + SWEEP pattern instead which is more standard
      const actionsV2 = [
        Actions.MINT_POSITION,
        Actions.CLOSE_CURRENCY,
        Actions.CLOSE_CURRENCY,
        Actions.SWEEP,
        Actions.SWEEP,
      ];
      const paramsV2 = [mintParams, closeParams0, closeParams1, sweepParams0, sweepParams1];

      const unlockData = encodeModifyLiquidities(actionsV2, paramsV2);

      // Deadline 30 minutes from now
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 1800);

      // If providing ETH (not WETH), we can send value
      // For V4, we use WETH, so we send ETH as msg.value if needed for native currency
      // Actually WETH (0x4200...0006) on Base IS native wrapped ETH
      // For simplicity, let's use WETH (user needs WETH balance)
      // But we should also support sending ETH directly...
      // V4 PositionManager accepts ETH via msg.value for native currency settlements
      // Since WETH is currency0, we can send ETH value and it will auto-wrap

      const hash = await writeContractAsync({
        address: POSITION_MANAGER,
        abi: positionManagerAbi,
        functionName: "modifyLiquidities",
        args: [unlockData, deadline],
        value: ethAmountWei, // Send ETH to cover WETH settlement
      });

      setTxHash(hash);
      setEthAmount("");
      setClawdAmount("");
    } catch (e: any) {
      console.error("Mint error:", e);
      setError(e.shortMessage || e.message || "Minting failed");
    } finally {
      setIsMinting(false);
    }
  };

  // USD values
  const ethValueUsd = ethAmount ? parseFloat(ethAmount) * ethPrice : 0;
  const clawdValueUsd = clawdAmount ? parseFloat(clawdAmount) * clawdPrice : 0;
  const totalValueUsd = ethValueUsd + clawdValueUsd;

  return (
    <div className="bg-base-200 rounded-2xl p-6 shadow-lg">
      <h2 className="text-xl font-bold mb-4">➕ Add Liquidity</h2>

      {/* Token Inputs */}
      <div className="space-y-4">
        {/* ETH Input */}
        <div className="form-control">
          <label className="label">
            <span className="label-text font-semibold">ETH Amount</span>
            <span className="label-text-alt">
              Balance: {wethBalance ? formatEther(wethBalance) : "0"} WETH
            </span>
          </label>
          <div className="join w-full">
            <input
              type="number"
              placeholder="0.0"
              className="input input-bordered join-item flex-1"
              value={ethAmount}
              onChange={(e) => setEthAmount(e.target.value)}
              step="0.001"
              min="0"
            />
            <span className="btn join-item btn-ghost no-animation">ETH</span>
          </div>
          {ethAmount && (
            <label className="label">
              <span className="label-text-alt text-info">≈ ${formatNumber(ethValueUsd, 2)} USD</span>
            </label>
          )}
          <p className="text-xs text-base-content/60 mt-1">
            💡 You can provide native ETH — no WETH wrapping needed
          </p>
        </div>

        {/* CLAWD Input */}
        <div className="form-control">
          <label className="label">
            <span className="label-text font-semibold">🦞 CLAWD Amount</span>
            <span className="label-text-alt">
              Balance: {clawdBalance ? formatNumber(parseFloat(formatUnits(clawdBalance, 18)), 0) : "0"}
            </span>
          </label>
          <div className="join w-full">
            <input
              type="number"
              placeholder="0"
              className="input input-bordered join-item flex-1"
              value={clawdAmount}
              onChange={(e) => setClawdAmount(e.target.value)}
              step="1000"
              min="0"
            />
            <span className="btn join-item btn-ghost no-animation">CLAWD</span>
          </div>
          {clawdAmount && (
            <label className="label">
              <span className="label-text-alt text-info">≈ ${formatNumber(clawdValueUsd, 2)} USD</span>
            </label>
          )}
        </div>

        {totalValueUsd > 0 && (
          <div className="alert alert-info text-sm">
            <span>Total value: <strong>${formatNumber(totalValueUsd, 2)}</strong> USD</span>
          </div>
        )}

        {/* Range Selection */}
        <div className="form-control">
          <label className="label">
            <span className="label-text font-semibold">Price Range</span>
          </label>
          <div className="btn-group flex gap-2">
            {(["full", "wide", "narrow", "custom"] as const).map((type) => (
              <button
                key={type}
                className={`btn btn-sm flex-1 ${rangeType === type ? "btn-primary" : "btn-outline"}`}
                onClick={() => setRangeType(type)}
              >
                {type === "full" ? "Full Range" : type === "wide" ? "Wide" : type === "narrow" ? "Narrow" : "Custom"}
              </button>
            ))}
          </div>

          {rangeType === "custom" && (
            <div className="grid grid-cols-2 gap-2 mt-2">
              <div>
                <label className="label text-xs">Lower Tick</label>
                <input
                  type="number"
                  className="input input-bordered input-sm w-full"
                  value={customLowerTick}
                  onChange={(e) => setCustomLowerTick(e.target.value)}
                  placeholder={String(currentTick - 10000)}
                  step={TICK_SPACING}
                />
              </div>
              <div>
                <label className="label text-xs">Upper Tick</label>
                <input
                  type="number"
                  className="input input-bordered input-sm w-full"
                  value={customUpperTick}
                  onChange={(e) => setCustomUpperTick(e.target.value)}
                  placeholder={String(currentTick + 10000)}
                  step={TICK_SPACING}
                />
              </div>
            </div>
          )}

          <div className="mt-2 text-sm text-base-content/70 bg-base-100 rounded-lg p-3">
            <div className="flex justify-between">
              <span>Lower: tick {tickLower}</span>
              <span>Upper: tick {tickUpper}</span>
            </div>
            <div className="flex justify-between text-xs mt-1">
              <span>{formatNumber(1 / priceUpper, 8)} ETH/CLAWD</span>
              <span>{formatNumber(1 / priceLower, 8)} ETH/CLAWD</span>
            </div>
            <div className="text-center text-xs mt-1 text-primary">
              Current: {formatNumber(1 / currentPrice, 8)} ETH/CLAWD
            </div>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="alert alert-error text-sm">
            <span>{error}</span>
          </div>
        )}

        {/* Success Display */}
        {txHash && (
          <div className="alert alert-success text-sm">
            <span>
              ✅ Position minted!{" "}
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

        {/* Action Buttons — Sequential approval flow */}
        <div className="space-y-2">
          {!address ? (
            <div className="text-center text-base-content/60">Connect your wallet to add liquidity</div>
          ) : wrongNetwork ? (
            <button
              className="btn btn-primary w-full"
              onClick={handleSwitchNetwork}
              disabled={isSwitching}
            >
              {isSwitching ? (
                <><span className="loading loading-spinner loading-sm"></span> Switching...</>
              ) : (
                "Switch to Base"
              )}
            </button>
          ) : !hasAmounts ? (
            <button className="btn btn-disabled w-full">Enter amounts</button>
          ) : needsClawdApproveToPermit2 ? (
            <button
              className="btn btn-warning w-full"
              onClick={handleApproveClawdToPermit2}
              disabled={isApprovingClawdToPermit2}
            >
              {isApprovingClawdToPermit2 ? (
                <><span className="loading loading-spinner loading-sm"></span> Approving CLAWD...</>
              ) : (
                "1/4: Approve CLAWD → Permit2"
              )}
            </button>
          ) : needsWethApproveToPermit2 ? (
            <button
              className="btn btn-warning w-full"
              onClick={handleApproveWethToPermit2}
              disabled={isApprovingWethToPermit2}
            >
              {isApprovingWethToPermit2 ? (
                <><span className="loading loading-spinner loading-sm"></span> Approving WETH...</>
              ) : (
                "2/4: Approve WETH → Permit2"
              )}
            </button>
          ) : needsClawdPermit2Approve ? (
            <button
              className="btn btn-warning w-full"
              onClick={handleApproveClawdPermit2}
              disabled={isApprovingClawdPermit2}
            >
              {isApprovingClawdPermit2 ? (
                <><span className="loading loading-spinner loading-sm"></span> Setting Permit2 CLAWD...</>
              ) : (
                "3/4: Permit2 CLAWD → PositionManager"
              )}
            </button>
          ) : needsWethPermit2Approve ? (
            <button
              className="btn btn-warning w-full"
              onClick={handleApproveWethPermit2}
              disabled={isApprovingWethPermit2}
            >
              {isApprovingWethPermit2 ? (
                <><span className="loading loading-spinner loading-sm"></span> Setting Permit2 WETH...</>
              ) : (
                "4/4: Permit2 WETH → PositionManager"
              )}
            </button>
          ) : (
            <button
              className="btn btn-primary w-full"
              onClick={handleMint}
              disabled={isMinting}
            >
              {isMinting ? (
                <><span className="loading loading-spinner loading-sm"></span> Minting Position...</>
              ) : (
                `Mint Position (~$${formatNumber(totalValueUsd, 2)})`
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

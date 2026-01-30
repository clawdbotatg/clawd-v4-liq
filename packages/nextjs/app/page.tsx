"use client";

import { useEffect, useState } from "react";
import type { NextPage } from "next";
import { PoolInfo } from "./components/PoolInfo";
import { AddLiquidity } from "./components/AddLiquidity";
import { Positions } from "./components/Positions";

const Home: NextPage = () => {
  const [ethPrice, setEthPrice] = useState(3200);
  const [clawdPrice, setClawdPrice] = useState(0.0001395);

  // Fetch prices
  useEffect(() => {
    const fetchPrices = async () => {
      try {
        const res = await fetch(
          "https://api.dexscreener.com/latest/dex/tokens/0x9f86dB9fc6f7c9408e8Fda3Ff8ce4e78ac7a6b07"
        );
        const data = await res.json();
        const mainPair = data?.pairs?.[0];
        if (mainPair) {
          setClawdPrice(parseFloat(mainPair.priceUsd || "0.0001395"));
          // DexScreener also has the quote token price
          if (mainPair.priceNative) {
            const ethPriceCalc = parseFloat(mainPair.priceUsd) / parseFloat(mainPair.priceNative);
            if (ethPriceCalc > 100) setEthPrice(ethPriceCalc);
          }
        }
      } catch (e) {
        console.error("Price fetch error:", e);
      }
    };

    fetchPrices();
    const interval = setInterval(fetchPrices, 30000); // refresh every 30s
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col grow">
      <div className="max-w-4xl mx-auto w-full px-4 py-6 space-y-6">
        {/* Pool Info */}
        <PoolInfo ethPrice={ethPrice} clawdPrice={clawdPrice} />

        {/* Two-column layout on desktop */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Add Liquidity */}
          <AddLiquidity ethPrice={ethPrice} clawdPrice={clawdPrice} />

          {/* Positions */}
          <Positions ethPrice={ethPrice} clawdPrice={clawdPrice} />
        </div>

        {/* Info section */}
        <div className="bg-base-200 rounded-2xl p-6 shadow-lg">
          <h2 className="text-xl font-bold mb-3">ℹ️ How V4 Liquidity Works</h2>
          <div className="text-sm space-y-2 text-base-content/80">
            <p>
              <strong>Uniswap V4</strong> uses concentrated liquidity — you choose a price range for your position.
              Narrower ranges earn more fees when the price stays in range, but go out of range more easily.
            </p>
            <p>
              <strong>Approval Flow:</strong> V4 uses Permit2 for token approvals. You&apos;ll need to:
              (1) Approve tokens to Permit2, then (2) Approve Permit2 to spend via PositionManager.
              This is a one-time setup per token.
            </p>
            <p>
              <strong>Range Types:</strong> Full Range covers all possible prices (like V2).
              Wide ±40,000 ticks gives broad coverage. Narrow ±4,000 ticks is more concentrated.
            </p>
            <p>
              <strong>Pool:</strong>{" "}
              <a
                href="https://basescan.org/address/0x7c5f5a4bbd8fd63184577525326123b519429bdc"
                target="_blank"
                rel="noopener noreferrer"
                className="link text-primary"
              >
                PositionManager
              </a>{" "}
              |{" "}
              <a
                href="https://app.uniswap.org/explore/pools/base/0x9fd58e73d8047cb14ac540acd141d3fc1a41fb6252d674b730faf62fe24aa8ce"
                target="_blank"
                rel="noopener noreferrer"
                className="link text-primary"
              >
                View Pool on Uniswap
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;

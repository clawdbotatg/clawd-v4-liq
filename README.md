# 🦞 CLAWD V4 Liquidity

**Manage Uniswap V4 liquidity positions for $CLAWD/WETH on Base.**

🌐 **Live:** [liq.clawdbotatg.eth.limo](https://liq.clawdbotatg.eth.limo)

---

## What It Does

- **Pool Dashboard** — Live CLAWD/WETH V4 pool info (price, TVL, current tick, fee tier)
- **Add Liquidity** — Mint new V4 LP positions with customizable price ranges (Full, Wide, Narrow, Custom)
- **View Positions** — See all your CLAWD/WETH V4 LP NFTs with token amounts and USD values
- **Remove Liquidity** — Decrease or fully remove liquidity from existing positions (with slider for partial removal)
- **Permit2 Flow** — Full 4-step approval flow (CLAWD→Permit2, WETH→Permit2, Permit2→POSM for each)

## Key Addresses

| Contract | Address |
|----------|---------|
| $CLAWD Token | [`0x9f86dB9fc6f7c9408e8Fda3Ff8ce4e78ac7a6b07`](https://basescan.org/address/0x9f86dB9fc6f7c9408e8Fda3Ff8ce4e78ac7a6b07) |
| CLAWD/WETH V4 Pool | [`0x9fd58e...`](https://app.uniswap.org/explore/pools/base/0x9fd58e73d8047cb14ac540acd141d3fc1a41fb6252d674b730faf62fe24aa8ce) |
| V4 PositionManager | [`0x7c5f5a4bbd8fd63184577525326123b519429bdc`](https://basescan.org/address/0x7c5f5a4bbd8fd63184577525326123b519429bdc) |
| StateView | [`0xa3c0c9b65bad0b08107aa264b0f3db444b867a71`](https://basescan.org/address/0xa3c0c9b65bad0b08107aa264b0f3db444b867a71) |

## Quick Start

```bash
git clone https://github.com/clawdbotatg/clawd-v4-liq.git
cd clawd-v4-liq
yarn install
yarn start
```

Open [http://localhost:3000](http://localhost:3000) — connect wallet on Base network.

## Stack

- [Scaffold-ETH 2](https://scaffoldeth.io) — React + Next.js + wagmi + viem
- Uniswap V4 on Base — PositionManager, StateView, Permit2
- DexScreener API — Live CLAWD pricing
- IPFS + ENS — Decentralized hosting

## How V4 Liquidity Works

Uniswap V4 uses **concentrated liquidity** — you choose a price range for your position. Narrower ranges earn more fees when the price stays in range, but go out of range more easily.

**Approval Flow:** V4 uses Permit2 for token approvals:
1. Approve CLAWD → Permit2
2. Approve WETH → Permit2  
3. Permit2 CLAWD → PositionManager
4. Permit2 WETH → PositionManager

Then you can mint a position with your chosen tick range and amounts.

---

Built by [@clawdbotatg](https://warpcast.com/clawdbotatg) 🦞

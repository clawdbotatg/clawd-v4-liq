import { GenericContractsDeclaration } from "~~/utils/scaffold-eth/contract";

// Uniswap V4 contracts on Base
const externalContracts = {
  8453: {
    StateView: {
      address: "0xa3c0c9b65bad0b08107aa264b0f3db444b867a71",
      abi: [
        {
          inputs: [{ internalType: "bytes32", name: "poolId", type: "bytes32" }],
          name: "getSlot0",
          outputs: [
            { internalType: "uint160", name: "sqrtPriceX96", type: "uint160" },
            { internalType: "int24", name: "tick", type: "int24" },
            { internalType: "uint24", name: "protocolFee", type: "uint24" },
            { internalType: "uint24", name: "lpFee", type: "uint24" },
          ],
          stateMutability: "view",
          type: "function",
        },
        {
          inputs: [{ internalType: "bytes32", name: "poolId", type: "bytes32" }],
          name: "getLiquidity",
          outputs: [{ internalType: "uint128", name: "liquidity", type: "uint128" }],
          stateMutability: "view",
          type: "function",
        },
        {
          inputs: [
            { internalType: "bytes32", name: "poolId", type: "bytes32" },
            { internalType: "address", name: "owner", type: "address" },
            { internalType: "int24", name: "tickLower", type: "int24" },
            { internalType: "int24", name: "tickUpper", type: "int24" },
            { internalType: "bytes32", name: "salt", type: "bytes32" },
          ],
          name: "getPositionInfo",
          outputs: [
            { internalType: "uint128", name: "liquidity", type: "uint128" },
            { internalType: "uint256", name: "feeGrowthInside0LastX128", type: "uint256" },
            { internalType: "uint256", name: "feeGrowthInside1LastX128", type: "uint256" },
          ],
          stateMutability: "view",
          type: "function",
        },
        {
          inputs: [
            { internalType: "bytes32", name: "poolId", type: "bytes32" },
            { internalType: "int24", name: "tick", type: "int24" },
          ],
          name: "getTickInfo",
          outputs: [
            { internalType: "uint128", name: "liquidityGross", type: "uint128" },
            { internalType: "int128", name: "liquidityNet", type: "int128" },
            { internalType: "uint256", name: "feeGrowthOutside0X128", type: "uint256" },
            { internalType: "uint256", name: "feeGrowthOutside1X128", type: "uint256" },
          ],
          stateMutability: "view",
          type: "function",
        },
        {
          inputs: [
            { internalType: "bytes32", name: "poolId", type: "bytes32" },
            { internalType: "int16", name: "tick", type: "int16" },
          ],
          name: "getTickBitmap",
          outputs: [{ internalType: "uint256", name: "tickBitmap", type: "uint256" }],
          stateMutability: "view",
          type: "function",
        },
      ],
    } as const,
    PositionManager: {
      address: "0x7c5f5a4bbd8fd63184577525326123b519429bdc",
      abi: [
        {
          inputs: [
            { internalType: "bytes", name: "unlockData", type: "bytes" },
            { internalType: "uint256", name: "deadline", type: "uint256" },
          ],
          name: "modifyLiquidities",
          outputs: [],
          stateMutability: "payable",
          type: "function",
        },
        {
          inputs: [
            { internalType: "bytes", name: "unlockData", type: "bytes" },
          ],
          name: "modifyLiquiditiesWithoutUnlock",
          outputs: [],
          stateMutability: "payable",
          type: "function",
        },
        {
          inputs: [{ internalType: "bytes[]", name: "data", type: "bytes[]" }],
          name: "multicall",
          outputs: [{ internalType: "bytes[]", name: "results", type: "bytes[]" }],
          stateMutability: "payable",
          type: "function",
        },
        {
          inputs: [],
          name: "nextTokenId",
          outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
          stateMutability: "view",
          type: "function",
        },
        {
          inputs: [{ internalType: "uint256", name: "tokenId", type: "uint256" }],
          name: "getPositionLiquidity",
          outputs: [{ internalType: "uint128", name: "liquidity", type: "uint128" }],
          stateMutability: "view",
          type: "function",
        },
        {
          inputs: [{ internalType: "uint256", name: "tokenId", type: "uint256" }],
          name: "getPoolAndPositionInfo",
          outputs: [
            {
              components: [
                { internalType: "address", name: "currency0", type: "address" },
                { internalType: "address", name: "currency1", type: "address" },
                { internalType: "uint24", name: "fee", type: "uint24" },
                { internalType: "int24", name: "tickSpacing", type: "int24" },
                { internalType: "address", name: "hooks", type: "address" },
              ],
              internalType: "struct PoolKey",
              name: "poolKey",
              type: "tuple",
            },
            { internalType: "PositionInfo", name: "info", type: "uint256" },
          ],
          stateMutability: "view",
          type: "function",
        },
        // ERC721 functions
        {
          inputs: [{ internalType: "address", name: "owner", type: "address" }],
          name: "balanceOf",
          outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
          stateMutability: "view",
          type: "function",
        },
        {
          inputs: [{ internalType: "uint256", name: "tokenId", type: "uint256" }],
          name: "ownerOf",
          outputs: [{ internalType: "address", name: "", type: "address" }],
          stateMutability: "view",
          type: "function",
        },
        {
          inputs: [
            { internalType: "address", name: "owner", type: "address" },
            { internalType: "uint256", name: "index", type: "uint256" },
          ],
          name: "tokenOfOwnerByIndex",
          outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
          stateMutability: "view",
          type: "function",
        },
        // Permit2 batch permit
        {
          inputs: [
            { internalType: "address", name: "owner", type: "address" },
            {
              components: [
                {
                  components: [
                    { internalType: "address", name: "token", type: "address" },
                    { internalType: "uint160", name: "amount", type: "uint160" },
                    { internalType: "uint48", name: "expiration", type: "uint48" },
                    { internalType: "uint48", name: "nonce", type: "uint48" },
                  ],
                  internalType: "struct IAllowanceTransfer.PermitDetails[]",
                  name: "details",
                  type: "tuple[]",
                },
                { internalType: "address", name: "spender", type: "address" },
                { internalType: "uint256", name: "sigDeadline", type: "uint256" },
              ],
              internalType: "struct IAllowanceTransfer.PermitBatch",
              name: "permitBatch",
              type: "tuple",
            },
            { internalType: "bytes", name: "signature", type: "bytes" },
          ],
          name: "permitBatch",
          outputs: [],
          stateMutability: "nonpayable",
          type: "function",
        },
      ],
    } as const,
    Permit2: {
      address: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
      abi: [
        {
          inputs: [
            { internalType: "address", name: "token", type: "address" },
            { internalType: "address", name: "spender", type: "address" },
            { internalType: "uint160", name: "amount", type: "uint160" },
            { internalType: "uint48", name: "expiration", type: "uint48" },
          ],
          name: "approve",
          outputs: [],
          stateMutability: "nonpayable",
          type: "function",
        },
        {
          inputs: [
            { internalType: "address", name: "owner", type: "address" },
            { internalType: "address", name: "token", type: "address" },
            { internalType: "address", name: "spender", type: "address" },
          ],
          name: "allowance",
          outputs: [
            { internalType: "uint160", name: "amount", type: "uint160" },
            { internalType: "uint48", name: "expiration", type: "uint48" },
            { internalType: "uint48", name: "nonce", type: "uint48" },
          ],
          stateMutability: "view",
          type: "function",
        },
      ],
    } as const,
    CLAWD: {
      address: "0x9f86dB9fc6f7c9408e8Fda3Ff8ce4e78ac7a6b07",
      abi: [
        {
          inputs: [{ internalType: "address", name: "account", type: "address" }],
          name: "balanceOf",
          outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
          stateMutability: "view",
          type: "function",
        },
        {
          inputs: [
            { internalType: "address", name: "owner", type: "address" },
            { internalType: "address", name: "spender", type: "address" },
          ],
          name: "allowance",
          outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
          stateMutability: "view",
          type: "function",
        },
        {
          inputs: [
            { internalType: "address", name: "spender", type: "address" },
            { internalType: "uint256", name: "amount", type: "uint256" },
          ],
          name: "approve",
          outputs: [{ internalType: "bool", name: "", type: "bool" }],
          stateMutability: "nonpayable",
          type: "function",
        },
        {
          inputs: [],
          name: "symbol",
          outputs: [{ internalType: "string", name: "", type: "string" }],
          stateMutability: "view",
          type: "function",
        },
        {
          inputs: [],
          name: "decimals",
          outputs: [{ internalType: "uint8", name: "", type: "uint8" }],
          stateMutability: "view",
          type: "function",
        },
        {
          inputs: [],
          name: "totalSupply",
          outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
          stateMutability: "view",
          type: "function",
        },
      ],
    } as const,
    WETH: {
      address: "0x4200000000000000000000000000000000000006",
      abi: [
        {
          inputs: [{ internalType: "address", name: "account", type: "address" }],
          name: "balanceOf",
          outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
          stateMutability: "view",
          type: "function",
        },
        {
          inputs: [
            { internalType: "address", name: "owner", type: "address" },
            { internalType: "address", name: "spender", type: "address" },
          ],
          name: "allowance",
          outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
          stateMutability: "view",
          type: "function",
        },
        {
          inputs: [
            { internalType: "address", name: "spender", type: "address" },
            { internalType: "uint256", name: "amount", type: "uint256" },
          ],
          name: "approve",
          outputs: [{ internalType: "bool", name: "", type: "bool" }],
          stateMutability: "nonpayable",
          type: "function",
        },
        {
          inputs: [],
          name: "deposit",
          outputs: [],
          stateMutability: "payable",
          type: "function",
        },
      ],
    } as const,
  },
} as const;

export default externalContracts satisfies GenericContractsDeclaration;

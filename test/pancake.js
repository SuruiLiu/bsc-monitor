const KNOWN_CONTRACTS = {
    "0x10ED43C718714eb63d5aA57B78B54704E256024E": {
        name: "PancakeSwap V2 Router",
        type: "DEX",
        methods: {
            "0x7ff36ab5": {
                name: "swapExactETHForTokens",
                interface: "function swapExactETHForTokens(uint256 amountOutMin, address[] path, address to, uint256 deadline) payable"
            },
            "0x38ed1739": {
                name: "swapExactTokensForTokens",
                interface: "function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, address[] path, address to, uint256 deadline)"
            },
            "0x791ac947": {
                name: "swapExactTokensForTokensSupportingFeeOnTransferTokens",
                interface: "function swapExactTokensForTokensSupportingFeeOnTransferTokens(uint256 amountIn, uint256 amountOutMin, address[] path, address to, uint256 deadline)"
            },
            "0x18cbafe5": {
                name: "swapExactTokensForETH",
                interface: "function swapExactTokensForETH(uint256 amountIn, uint256 amountOutMin, address[] path, address to, uint256 deadline)"
            },
            "0xfb3bdb41": {
                name: "swapETHForExactTokens",
                interface: "function swapETHForExactTokens(uint256 amountOut, address[] path, address to, uint256 deadline) payable"
            },
            "0x4a25d94a": {
                name: "swapTokensForExactETH",
                interface: "function swapTokensForExactETH(uint256 amountOut, uint256 amountInMax, address[] path, address to, uint256 deadline)"
            },
            "0x8803dbee": {
                name: "swapTokensForExactTokens",
                interface: "function swapTokensForExactTokens(uint256 amountOut, uint256 amountInMax, address[] path, address to, uint256 deadline)"
            },
            "0x5c11d795": {
                name: "swapExactTokensForETHSupportingFeeOnTransferTokens",
                interface: "function swapExactTokensForETHSupportingFeeOnTransferTokens(uint256 amountIn, uint256 amountOutMin, address[] path, address to, uint256 deadline)"
            }
        }
    },

    "0x13f4EA83D0bd40E75C8222255bc855a974568Dd4": {
        name: "PancakeSwap V3 Router",
        type: "DEX_V3",
        methods: {
            "0xc04b8d59": {
                name: "exactInputSingle",
                interface: "function exactInputSingle(tuple(address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96) params) returns (uint256 amountOut)"
            },
            "0x5ae401dc": {
                name: "multicall",
                interface: "function multicall(bytes[] data) payable returns (bytes[] results)"
            },
            "0x472b43f3": {
                name: "swapExactTokensForTokens",
                interface: "function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, address[] path, address to) returns (uint256 amountOut)"
            },
            "0x42712a67": {
                name: "swapExactTokensForTokensV2",
                interface: "function swapExactTokensForTokensV2(uint256 amountIn, uint256 amountOutMin, address[] path, address to) returns (uint256 amountOut)"
            },
            "0xb858183f": {
                name: "exactInput",
                interface: "function exactInput(tuple(bytes path, address recipient, uint256 amountIn, uint256 amountOutMinimum) params) returns (uint256 amountOut)"
            },
            "0x09b81346": {
                name: "exactOutput",
                interface: "function exactOutput(tuple(bytes path, address recipient, uint256 amountOut, uint256 amountInMaximum) params) returns (uint256 amountIn)"
            },
            "0x3df02124": {
                name: "exactOutputSingle",
                interface: "function exactOutputSingle(tuple(address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountOut, uint256 amountInMaximum, uint160 sqrtPriceLimitX96) params) returns (uint256 amountIn)"
            },
            "0xac9650d8": {
                name: "multicallWithoutCheck",
                interface: "function multicallWithoutCheck(bytes[] data) payable returns (bytes[] results)"
            }
        }
    },
    // Proxy 合约
    "0x75fF870A864B59f03ff3E67a65eF44Dea64f0cAf": {
        name: "PancakeSwap V3 Router (Proxy)",
        type: "DEX_V3_PROXY",
        implementation: "0x13f4EA83D0bd40E75C8222255bc855a974568Dd4"
    }
};


export const pancake = KNOWN_CONTRACTS;
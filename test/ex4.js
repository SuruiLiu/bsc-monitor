const { WebSocketProvider, Interface } = require("ethers");
const ethers = require("ethers");

const wsUrl = "wss://bsc.publicnode.com";
let provider;

// 添加常见代币映射
const KNOWN_TOKENS = {
    "0x55d398326f99059fF775485246999027B3197955": "USDT",
    "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c": "BNB",
    "0x47A1EB0b825b73e6A14807BEaECAFef199d5477c": "BUSD",
    "0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82": "CAKE",
    "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d": "USDC"
};

// ERC20接口，用于查询代币符号
const ERC20_ABI = ["function symbol() view returns (string)"];
const tokenSymbolCache = new Map();

async function getTokenSymbol(address) {
    if (KNOWN_TOKENS[address]) {
        return KNOWN_TOKENS[address];
    }

    if (tokenSymbolCache.has(address)) {
        return tokenSymbolCache.get(address);
    }

    try {
        const tokenContract = new ethers.Contract(address, ERC20_ABI, provider);
        const symbol = await tokenContract.symbol();
        tokenSymbolCache.set(address, symbol);
        return symbol;
    } catch (error) {
        return address.slice(0, 6) + "...";
    }
}

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
            }
        }
    },
};

async function setupEventListeners() {
    provider.on("block", async (blockNumber) => {
        try {
            const block = await provider.getBlock(blockNumber);
            console.log(`\n检测到新区块: ${blockNumber}`);
            console.log(`总交易数: ${block.transactions.length}`);

            const txPromises = block.transactions.map(txHash => provider.getTransaction(txHash));
            const transactions = await Promise.all(txPromises);

            for (const tx of transactions) {
                try {
                    if (!tx.data || tx.data === '0x') continue;

                    const methodId = tx.data.slice(0, 10);
                    const knownContract = KNOWN_CONTRACTS[tx.to];

                    if (knownContract) {
                        const method = knownContract.methods[methodId];
                        if (!method) continue;

                        console.log(`\n${tx.from} 在 ${knownContract.name} 上调用了 ${method.name}`);
                        console.log(`交易哈希: ${tx.hash}`);

                        const iface = new Interface([method.interface]);
                        const decoded = iface.parseTransaction({ data: tx.data });

                        if (decoded) {
                            if (method.name === "swapExactTokensForTokens" || method.name === "swapExactTokensForTokensSupportingFeeOnTransferTokens") {
                                const inputToken = await getTokenSymbol(decoded.args[2][0]);
                                const outputToken = await getTokenSymbol(decoded.args[2][decoded.args[2].length - 1]);
                                console.log(`输入: ${ethers.formatEther(decoded.args[0])} ${inputToken}`);
                                console.log(`最小输出: ${ethers.formatEther(decoded.args[1])} ${outputToken}`);
                            } else if (method.name === "swapExactETHForTokens") {
                                const outputToken = await getTokenSymbol(decoded.args[1][decoded.args[1].length - 1]);
                                console.log(`输入: ${ethers.formatEther(tx.value)} BNB`);
                                console.log(`最小输出: ${ethers.formatEther(decoded.args[0])} ${outputToken}`);
                            }
                        }
                    }

                } catch (e) {
                    continue;
                }
            }

        } catch (err) {
            console.error("处理区块数据时出错:", err);
            await reconnect();
        }
    });

    provider.websocket.on("error", async (err) => {
        console.error("WebSocket 错误，尝试重连...");
        await reconnect();
    });

    provider.websocket.on("close", async () => {
        console.error("WebSocket 关闭，尝试重连...");
        await reconnect();
    });
}

async function reconnect() {
    try {
        if (provider) {
            provider.removeAllListeners();
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
        provider = new WebSocketProvider(wsUrl);
        await setupEventListeners();
    } catch (error) {
        console.error("重连失败，1秒后重试...");
        setTimeout(reconnect, 1000);
    }
}

async function initialize() {
    try {
        provider = new WebSocketProvider(wsUrl);
        await setupEventListeners();
    } catch (error) {
        console.error("初始化失败，尝试重连...");
        await reconnect();
    }
}

initialize();
const { WebSocketProvider, Interface } = require("ethers");
const ethers = require("ethers");

const wsUrl = "wss://bsc.publicnode.com";
let provider;
const contractCalls = new Map();

const KNOWN_CONTRACTS = {
    "0x10ED43C718714eb63d5aA57B78B54704E256024E": {
        name: "PancakeSwap V2 Router",
        type: "DEX",
        methods: {
            "0x7ff36ab5": "swapExactETHForTokens",
            "0x38ed1739": "swapExactTokensForTokens",
            "0x18cbafe5": "swapExactTokensForETH",
            "0xb6f9de95": "swapExactTokensForETHSupportingFeeOnTransferTokens",
            "0x791ac947": "swapExactTokensForTokensSupportingFeeOnTransferTokens",
            "0x5c11d795": "swapExactTokensForTokensFeeOnTransfer",
            "0xfb3bdb41": "swapETHForExactTokens",
            "0x4a25d94a": "swapTokensForExactETH",
            "0x8803dbee": "swapTokensForExactTokens",
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
                        const methodName = knownContract.methods[methodId] || "未知方法";
                        console.log(`\n${tx.from} 在 ${knownContract.name} 上调用了 ${methodName}`);
                        console.log(`交易哈希: ${tx.hash}`);
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
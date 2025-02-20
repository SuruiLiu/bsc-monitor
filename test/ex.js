const { WebSocketProvider, Interface } = require("ethers");
const ethers = require("ethers");

// 提供多个备用节点
const WS_URLS = [
    "wss://bsc-ws-node.nariox.org:443",
    "wss://bsc.publicnode.com",
    "wss://bsc-mainnet.publicnode.com",
    "wss://bsc.nodereal.io",
    // 添加更多备用节点
];

let currentUrlIndex = 0;
let provider;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const contractCalls = new Map();

const KNOWN_CONTRACTS = {
    "0x10ED43C718714eb63d5aA57B78B54704E256024E": {
        name: "PancakeSwap V2 Router",
        type: "DEX",
        methods: {
            "0x7ff36ab5": "swapExactETHForTokens",
            "0x38ed1739": "swapExactTokensForTokens",
            "0x18cbafe5": "swapExactTokensForETH",
            // ... 其他方法签名
        }
    },
};

async function createProvider() {
    const url = WS_URLS[currentUrlIndex];
    console.log(`尝试连接到节点: ${url}`);
    return new WebSocketProvider(url);
}

async function setupEventListeners() {
    provider.on("block", async (blockNumber) => {
        console.log(`\n检测到新区块: ${blockNumber}`);
        try {
            const block = await provider.getBlock(blockNumber);
            console.log(`区块 ${blockNumber} 总交易数: ${block.transactions.length}`);

            // 限制每个区块处理的交易数量，避免过载
            const MAX_TX_TO_PROCESS = 50;
            const txsToProcess = block.transactions.slice(0, MAX_TX_TO_PROCESS);

            console.log(`处理前 ${MAX_TX_TO_PROCESS} 笔交易...`);

            const txPromises = txsToProcess.map(async txHash => {
                try {
                    const tx = await provider.getTransaction(txHash);
                    return tx;
                } catch (e) {
                    console.error(`获取交易 ${txHash} 失败:`, e.message);
                    return null;
                }
            });

            const transactions = (await Promise.all(txPromises)).filter(tx => tx != null);
            console.log(`成功获取 ${transactions.length} 笔交易详情`);

            for (const tx of transactions) {
                try {
                    if (!tx.data || tx.data === '0x') {
                        console.log('跳过普通转账交易');
                        continue;
                    }

                    const methodId = tx.data.slice(0, 10);
                    const knownContract = KNOWN_CONTRACTS[tx.to];

                    if (knownContract) {
                        console.log('\n发现已知合约交易:');
                        console.log(`合约地址: ${tx.to}`);
                        console.log(`方法ID: ${methodId}`);

                        const methodName = knownContract.methods[methodId] || "未知方法";
                        console.log(`\n交易详情:`);
                        console.log(`合约: ${knownContract.name}`);
                        console.log(`方法: ${methodName}`);
                        console.log(`交易哈希: ${tx.hash}`);

                        // ... 剩余的交易解析逻辑 ...
                    }
                } catch (e) {
                    console.error("处理单笔交易时出错:", e.message);
                }
            }

        } catch (err) {
            console.error("处理区块数据时出错:", err);
            await handleConnectionError(err);
        }
    });

    provider.websocket.on("error", async (err) => {
        console.error("WebSocket 错误:", err);
        await handleConnectionError(err);
    });

    provider.websocket.on("close", async (code, reason) => {
        console.error(`WebSocket 关闭: ${code} ${reason}`);
        await handleConnectionError(new Error("Connection closed"));
    });
}

async function handleConnectionError(error) {
    console.error("连接错误:", error.message);
    reconnectAttempts++;

    if (reconnectAttempts > MAX_RECONNECT_ATTEMPTS) {
        currentUrlIndex = (currentUrlIndex + 1) % WS_URLS.length;
        reconnectAttempts = 0;
        console.log(`切换到下一个节点，索引: ${currentUrlIndex}`);
    }

    setTimeout(reconnect, 5000);
}

async function reconnect() {
    try {
        if (provider) {
            provider.removeAllListeners();
        }
        provider = await createProvider();
        console.log("重新连接成功");
        await setupEventListeners();
        reconnectAttempts = 0;
    } catch (error) {
        console.error("重连失败:", error);
        await handleConnectionError(error);
    }
}

// 初始化
async function initialize() {
    try {
        provider = await createProvider();
        await setupEventListeners();
    } catch (error) {
        console.error("初始化失败:", error);
        await handleConnectionError(error);
    }
}

initialize();
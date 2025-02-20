const { WebSocketProvider, Interface } = require("ethers");
const ethers = require("ethers");

const wsUrl = "wss://bsc.publicnode.com";
let provider;

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
    provider.once("block", async (blockNumber) => {
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

                        // 解析交易参数
                        const iface = new Interface([method.interface]);
                        const decoded = iface.parseTransaction({ data: tx.data });

                        if (decoded) {
                            if (method.name === "swapExactTokensForTokens" || method.name === "swapExactTokensForTokensSupportingFeeOnTransferTokens") {
                                console.log(`输入金额: ${ethers.formatEther(decoded.args[0])} 代币`);
                                console.log(`最小输出金额: ${ethers.formatEther(decoded.args[1])} 代币`);
                                console.log(`代币路径: ${decoded.args[2][0]} (输入) -> ${decoded.args[2][decoded.args[2].length - 1]} (输出)`);
                                console.log(`接收地址: ${decoded.args[3]}`);
                                console.log(`截止时间: ${new Date(Number(decoded.args[4]) * 1000).toLocaleString()}`);
                            } else if (method.name === "swapExactETHForTokens") {
                                console.log(`输入金额: ${ethers.formatEther(tx.value)} BNB`);
                                console.log(`最小输出金额: ${ethers.formatEther(decoded.args[0])} 代币`);
                                console.log(`代币路径: ${decoded.args[1][0]} (BNB) -> ${decoded.args[1][decoded.args[1].length - 1]} (输出)`);
                                console.log(`接收地址: ${decoded.args[2]}`);
                                console.log(`截止时间: ${new Date(Number(decoded.args[3]) * 1000).toLocaleString()}`);
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
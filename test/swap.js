const { WebSocketProvider, ethers } = require("ethers");
const { wsUrl } = require('../utils/config');
const { sa } = require('../utils/smartAddress');
const { getTokenDecimals } = require('../utils/token');

let provider;
let isConnected = false;
let eventCount = 0;
let lastEventTime = Date.now();

// 监听的事件签名
const TRANSFER_EVENT_SIG = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const DEPOSIT_EVENT_SIG = "0xe1fffcc4923d04b559f4d29a8bfc6cda04eb5b0d3c460751c2402c5c5cc9109c";
const WITHDRAWAL_EVENT_SIG = "0x7fcf532c15f0a6db0bd6d0e038bea71d30d808c7d98cb3bf7268a95bf5081b65";

// BSC 网络的 WBNB 地址
const WBNB_ADDRESS = "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c";

// 监控地址的 Set
const smartAddresses = new Set(sa.map(addr => addr.toLowerCase()));

async function identifySwap(txReceipt, fromAddress) {
    try {
        // 获取原始交易信息，查看是否有 native token 转账
        const tx = await provider.getTransaction(txReceipt.transactionHash);
        if (!tx) return null;

        let nativeTokenAmount = null;
        if (tx.value > 0) {
            nativeTokenAmount = ethers.formatEther(tx.value);
        }

        let inToken = null;
        let outToken = null;
        let foundDeposit = false;
        let foundWithdrawal = false;

        // 分析所有 logs
        for (const log of txReceipt.logs) {
            if (!log.topics || !log.topics[0]) continue;

            const eventSig = log.topics[0].toLowerCase();
            const tokenAddress = log.address.toLowerCase();

            // 如果是 Deposit 事件 (native token -> WBNB)
            if (eventSig === DEPOSIT_EVENT_SIG && tokenAddress === WBNB_ADDRESS) {
                foundDeposit = true;
                // 如果金额匹配，说明这是用户的 native token 换 WBNB
                if (nativeTokenAmount && ethers.formatEther(log.data) === nativeTokenAmount) {
                    outToken = {
                        type: 'native',
                        symbol: 'BNB',
                        value: nativeTokenAmount
                    };
                }
                continue;
            }

            // 如果是 Withdrawal 事件 (WBNB -> native token)
            if (eventSig === WITHDRAWAL_EVENT_SIG && tokenAddress === WBNB_ADDRESS) {
                foundWithdrawal = true;
                inToken = {
                    type: 'native',
                    symbol: 'BNB',
                    value: ethers.formatEther(log.data)
                };
                continue;
            }

            // 如果是 Transfer 事件
            if (eventSig === TRANSFER_EVENT_SIG && log.topics.length >= 3) {
                const from = ethers.getAddress("0x" + log.topics[1].slice(26)).toLowerCase();
                const to = ethers.getAddress("0x" + log.topics[2].slice(26)).toLowerCase();

                // 只处理与监控地址相关的 transfer
                if (from === fromAddress || to === fromAddress) {
                    try {
                        const decimals = await getTokenDecimals(tokenAddress, provider);
                        const value = ethers.formatUnits(log.data, decimals);

                        if (from === fromAddress && !outToken) {
                            outToken = {
                                type: 'erc20',
                                address: tokenAddress,
                                value: value
                            };
                        } else if (to === fromAddress && !inToken) {
                            inToken = {
                                type: 'erc20',
                                address: tokenAddress,
                                value: value
                            };
                        }
                    } catch (error) {
                        console.error(`Error getting token info for ${tokenAddress}:`, error);
                    }
                }
            }
        }

        // 确认是否为 swap 交易
        if (outToken && inToken) {
            // 检查是否是同一代币的转入转出
            if (outToken.type === inToken.type &&
                ((outToken.type === 'erc20' && outToken.address === inToken.address) ||
                    outToken.type === 'native')) {
                return null;
            }

            return {
                fromAddress,
                outToken,
                inToken,
                txHash: txReceipt.transactionHash
            };
        }

        return null;
    } catch (error) {
        console.error("Error analyzing swap:", error);
        return null;
    }
}

async function setupEventListeners() {
    console.log("\nInitializing swap monitor...");
    console.log("WebSocket URL:", wsUrl);
    console.log("Monitored addresses:", smartAddresses.size);

    try {
        const blockNumber = await provider.getBlockNumber();
        console.log("Current block height:", blockNumber);
        isConnected = true;

        // 监听所有可能的 swap 相关事件
        const filter = {
            topics: [[
                TRANSFER_EVENT_SIG,
                DEPOSIT_EVENT_SIG,
                WITHDRAWAL_EVENT_SIG
            ]]
        };

        provider.on(filter, async (log) => {
            try {
                if (!log || !log.topics || !log.transactionHash) return;

                // 获取交易的发起者
                const tx = await provider.getTransaction(log.transactionHash);
                if (!tx) return;

                const fromAddress = tx.from.toLowerCase();
                if (!smartAddresses.has(fromAddress)) return;

                const txReceipt = await provider.getTransactionReceipt(log.transactionHash);
                if (!txReceipt) return;

                const swapInfo = await identifySwap(txReceipt, fromAddress);
                if (!swapInfo) return;

                // 格式化输出信息
                let outInfo = swapInfo.outToken.type === 'native'
                    ? `${swapInfo.outToken.value} BNB`
                    : `${swapInfo.outToken.value} (${swapInfo.outToken.address})`;

                let inInfo = swapInfo.inToken.type === 'native'
                    ? `${swapInfo.inToken.value} BNB`
                    : `${swapInfo.inToken.value} (${swapInfo.inToken.address})`;

                const message = `Swap detected!\n` +
                    `Address: ${fromAddress}\n` +
                    `Out: ${outInfo}\n` +
                    `In: ${inInfo}\n` +
                    `TX: ${swapInfo.txHash}`;

                console.log(message);
                eventCount++;
                lastEventTime = Date.now();
            } catch (err) {
                console.error("Error processing event:", err);
            }
        });

        // Connection monitoring remains the same
        provider.on("block", (blockNumber) => {
            console.log(`\nNew block: ${blockNumber}`);
            isConnected = true;
        });

        provider.websocket.on("open", () => {
            console.log("WebSocket connection opened");
            isConnected = true;
        });

        provider.websocket.on("error", async (err) => {
            console.error("WebSocket error:", err.message);
            isConnected = false;
            await reconnect();
        });

        provider.websocket.on("close", async () => {
            console.error("WebSocket connection closed");
            isConnected = false;
            await reconnect();
        });

        setInterval(async () => {
            try {
                const timeSinceLastEvent = (Date.now() - lastEventTime) / 1000;
                console.log("\n--- Status Report ---");
                console.log("Connection status:", isConnected ? "Connected" : "Disconnected");
                console.log("Processed events:", eventCount);
                console.log(`Time since last event: ${timeSinceLastEvent.toFixed(1)}s`);

                if (timeSinceLastEvent > 30) {
                    const blockNumber = await provider.getBlockNumber();
                    console.log("Connection test - Current block:", blockNumber);
                }
            } catch (error) {
                console.error("Status check failed:", error.message);
                isConnected = false;
                await reconnect();
            }
        }, 10000);

    } catch (error) {
        console.error("Error setting up event listeners:", error);
        throw error;
    }
}

async function reconnect() {
    console.log("\nAttempting reconnection...");
    try {
        if (provider) {
            provider.removeAllListeners();
            if (provider.websocket) {
                provider.websocket.close();
            }
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
        provider = new WebSocketProvider(wsUrl);
        await setupEventListeners();
        console.log("Reconnection successful");
    } catch (error) {
        console.error("Reconnection failed:", error.message);
        setTimeout(reconnect, 1000);
    }
}

async function initialize() {
    console.log("\nInitializing...");
    try {
        provider = new WebSocketProvider(wsUrl);
        await setupEventListeners();
    } catch (error) {
        console.error("Initialization failed:", error);
        await reconnect();
    }
}

// 启动监控
initialize().catch(console.error);

// 优雅退出
process.on('SIGINT', () => {
    console.log('\nShutting down monitor...');
    if (provider) {
        provider.removeAllListeners();
        if (provider.websocket) {
            provider.websocket.close();
        }
    }
    process.exit(0);
});

// 错误处理
process.on('unhandledRejection', (error) => {
    console.error('Unhandled Promise rejection:', error);
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught exception:', error);
});
const { WebSocketProvider, ethers } = require("ethers");
const { wsUrl } = require('./utils/config');
const { getTokenDecimals } = require('./utils/token');
const { sendToTelegram } = require('./tgbot');

let provider;
let isConnected = false;
let eventCount = 0;
let lastEventTime = Date.now();

// Event signatures
const TRANSFER_EVENT_SIG = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const DEPOSIT_EVENT_SIG = "0xe1fffcc4923d04b559f4d29a8bfc6cda04eb5b0d3c460751c2402c5c5cc9109c";
const WITHDRAWAL_EVENT_SIG = "0x7fcf532c15f0a6db0bd6d0e038bea71d30d808c7d98cb3bf7268a95bf5081b65";

// WBNB address
const WBNB_ADDRESS = "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c";

async function setupEventListeners() {
    console.log("\nInitializing swap monitor...");
    console.log("WebSocket URL:", wsUrl);
    console.log("Monitoring all swaps...");

    try {
        const blockNumber = await provider.getBlockNumber();
        console.log("Current block height:", blockNumber);
        isConnected = true;

        // 监听所有相关事件
        const filter = {
            topics: [[
                TRANSFER_EVENT_SIG,
                DEPOSIT_EVENT_SIG,
                WITHDRAWAL_EVENT_SIG
            ]]
        };

        provider.on(filter, async (log) => {
            try {
                if (!log || !log.topics || log.topics.length < 3) return;

                const txReceipt = await provider.getTransactionReceipt(log.transactionHash);
                if (!txReceipt || !txReceipt.logs) return;

                const tx = await provider.getTransaction(log.transactionHash);
                if (!tx) return;

                // 获取当前事件的信息
                const eventSig = log.topics[0];
                let userAddress;

                if (eventSig === DEPOSIT_EVENT_SIG) {
                    // 处理 Deposit 事件
                    userAddress = tx.from.toLowerCase();
                    // 在后续日志中寻找 Transfer
                    for (const otherLog of txReceipt.logs) {
                        if (otherLog.logIndex <= log.logIndex) continue;
                        if (otherLog.topics[0] !== TRANSFER_EVENT_SIG) continue;

                        const transferTo = ethers.getAddress("0x" + otherLog.topics[2].slice(26)).toLowerCase();
                        if (transferTo === userAddress) {
                            // 找到了 gas token -> ERC20 的 swap
                            const inAmount = ethers.formatUnits(otherLog.data, await getTokenDecimals(otherLog.address, provider));
                            const outAmount = ethers.formatEther(tx.value);

                            const message = `Swap detected (Gas Token -> ERC20)!\n` +
                                `User: ${userAddress}\n` +
                                `Out: ${outAmount} BNB\n` +
                                `In: ${inAmount} (${otherLog.address})\n` +
                                `TX: ${log.transactionHash}`;

                            console.log(message);
                            await sendToTelegram(message);
                            break;
                        }
                    }
                } else if (eventSig === TRANSFER_EVENT_SIG) {
                    // 处理 Transfer 事件
                    const currentFrom = ethers.getAddress("0x" + log.topics[1].slice(26)).toLowerCase();
                    const currentTo = ethers.getAddress("0x" + log.topics[2].slice(26)).toLowerCase();
                    const currentToken = log.address.toLowerCase();

                    // 先检查是否有后续的 Withdrawal 事件
                    let foundWithdrawal = false;
                    for (const otherLog of txReceipt.logs) {
                        if (otherLog.logIndex <= log.logIndex) continue;

                        if (otherLog.topics[0] === WITHDRAWAL_EVENT_SIG &&
                            otherLog.address.toLowerCase() === WBNB_ADDRESS) {
                            const withdrawTo = "0x" + otherLog.topics[1].slice(26).toLowerCase();
                            if (withdrawTo === currentFrom) {
                                // ERC20 -> gas token swap
                                const outAmount = ethers.formatUnits(log.data, await getTokenDecimals(currentToken, provider));
                                const inAmount = ethers.formatEther(otherLog.data);

                                const message = `Swap detected (ERC20 -> Gas Token)!\n` +
                                    `User: ${currentFrom}\n` +
                                    `Out: ${outAmount} (${currentToken})\n` +
                                    `In: ${inAmount} BNB\n` +
                                    `TX: ${log.transactionHash}`;

                                console.log(message);
                                await sendToTelegram(message);
                                foundWithdrawal = true;
                                break;
                            }
                        }
                    }

                    // 如果没找到 Withdrawal，检查是否是普通的 ERC20->ERC20 swap
                    if (!foundWithdrawal) {
                        for (const otherLog of txReceipt.logs) {
                            if (!otherLog.topics || otherLog.topics[0] !== TRANSFER_EVENT_SIG) continue;
                            if (otherLog.logIndex <= log.logIndex) continue;

                            const otherTo = ethers.getAddress("0x" + otherLog.topics[2].slice(26)).toLowerCase();
                            const otherToken = otherLog.address.toLowerCase();

                            if (otherTo === currentFrom && currentToken !== otherToken) {
                                const outAmount = ethers.formatUnits(log.data, await getTokenDecimals(currentToken, provider));
                                const inAmount = ethers.formatUnits(otherLog.data, await getTokenDecimals(otherToken, provider));

                                const message = `Swap detected (ERC20 -> ERC20)!\n` +
                                    `User: ${currentFrom}\n` +
                                    `Router: ${currentTo}\n` +
                                    `Out: ${outAmount} (${currentToken})\n` +
                                    `In: ${inAmount} (${otherToken})\n` +
                                    `TX: ${log.transactionHash}`;

                                console.log(message);
                                await sendToTelegram(message);
                                break;
                            }
                        }
                    }
                }

                eventCount++;
                lastEventTime = Date.now();
            } catch (err) {
                console.error("Error processing event:", err);
            }
        });

        // Connection monitoring
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
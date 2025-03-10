// basePolling.js - 使用区块轮询方式监控Base链交易
const { JsonRpcProvider, ethers } = require("ethers");
const { getTokenDecimals, getTokenSymbol, WETH_ADDRESS } = require('./utils/baseToken');
const { sendToTelegram } = require('./tgbot');

// Base链的HTTP RPC URL
const BASE_HTTP_URL = "https://base-mainnet.public.blastapi.io";

let provider;
let isConnected = false;
let eventCount = 0;
let lastEventTime = Date.now();
let lastProcessedBlock = 0;

// Event signatures (仅用于识别)
const TRANSFER_EVENT_SIG = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const SWAP_EVENT_SIG = "0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822"; // Uniswap V2 Swap

// 通过轮询区块来监控交易
async function pollBlocks() {
    try {
        const currentBlock = await provider.getBlockNumber();

        if (currentBlock > lastProcessedBlock) {
            console.log(`\n检查区块 ${lastProcessedBlock + 1} 到 ${currentBlock}`);

            // 每次最多处理5个区块，避免过度请求
            const endBlock = Math.min(lastProcessedBlock + 5, currentBlock);

            for (let blockNum = lastProcessedBlock + 1; blockNum <= endBlock; blockNum++) {
                try {
                    console.log(`正在处理区块 #${blockNum}...`);

                    // 获取区块信息
                    const block = await provider.getBlock(blockNum);

                    if (!block || !block.transactions || block.transactions.length === 0) {
                        console.log(`区块 #${blockNum} 没有交易`);
                        continue;
                    }

                    console.log(`区块 #${blockNum} 有 ${block.transactions.length} 笔交易`);

                    // 处理该区块中的每笔交易
                    for (const txHash of block.transactions) {
                        try {
                            await processTransaction(txHash);
                        } catch (txError) {
                            console.error(`处理交易 ${txHash} 时出错:`, txError.message);
                            continue;
                        }
                    }
                } catch (blockError) {
                    console.error(`处理区块 #${blockNum} 时出错:`, blockError.message);
                    continue;
                }
            }

            lastProcessedBlock = endBlock;
            console.log(`已处理至区块 #${lastProcessedBlock}`);
        } else {
            console.log(`\n没有新区块。当前区块仍为 #${currentBlock}`);
        }
    } catch (error) {
        console.error("轮询区块时出错:", error.message);
        isConnected = false;
    }

    // 一段时间后再次轮询
    setTimeout(pollBlocks, 15000); // 每15秒轮询一次
}

// 处理单个交易
async function processTransaction(txHash) {
    // 获取交易收据
    const receipt = await provider.getTransactionReceipt(txHash);

    if (!receipt || !receipt.logs || receipt.logs.length === 0) {
        return; // 没有日志的交易不处理
    }

    // 获取交易详情
    const tx = await provider.getTransaction(txHash);
    if (!tx) return;

    // 提取发送者地址
    const sender = tx.from.toLowerCase();

    // 识别Transfer事件
    const transferLogs = receipt.logs.filter(log =>
        log.topics &&
        log.topics.length >= 3 &&
        log.topics[0] === TRANSFER_EVENT_SIG
    );

    // 识别明显的Swap事件
    const swapLogs = receipt.logs.filter(log =>
        log.topics &&
        log.topics.length >= 1 &&
        log.topics[0] === SWAP_EVENT_SIG
    );

    // 如果有Swap事件，可能是DEX交易
    if (swapLogs.length > 0) {
        await processSwapLogs(swapLogs, transferLogs, txHash, sender);
    }
    // 如果没有明显的Swap但有多个Transfer，可能是代币交换
    else if (transferLogs.length >= 2) {
        await processTransferLogs(transferLogs, txHash, sender);
    }
}

// 处理Swap日志
async function processSwapLogs(swapLogs, transferLogs, txHash, sender) {
    try {
        // 从Transfer事件中提取涉及的代币
        const tokenAddresses = [...new Set(transferLogs.map(log => log.address.toLowerCase()))];

        if (tokenAddresses.length >= 2) {
            // 涉及至少两种代币，很可能是交换
            const token1 = tokenAddresses[0];
            const token2 = tokenAddresses[1];

            // 获取代币详情
            const token1Symbol = await getTokenSymbol(token1, provider);
            const token2Symbol = await getTokenSymbol(token2, provider);

            // 尝试计算交换的金额
            let token1Amount = "未知";
            let token2Amount = "未知";

            // 查找用户接收和发送的代币
            for (const log of transferLogs) {
                if (!log.topics || log.topics.length < 3) continue;

                const tokenAddr = log.address.toLowerCase();
                const from = ethers.getAddress("0x" + log.topics[1].slice(26)).toLowerCase();
                const to = ethers.getAddress("0x" + log.topics[2].slice(26)).toLowerCase();

                // 如果用户是发送方或接收方，记录金额
                if (tokenAddr === token1 && (from === sender || to === sender)) {
                    const decimals = await getTokenDecimals(token1, provider);
                    token1Amount = ethers.formatUnits(log.data, decimals);
                } else if (tokenAddr === token2 && (from === sender || to === sender)) {
                    const decimals = await getTokenDecimals(token2, provider);
                    token2Amount = ethers.formatUnits(log.data, decimals);
                }
            }

            // 构建消息
            const message = `Base链交易发现!\n` +
                `用户: ${sender}\n` +
                `${token1Symbol} ${token1Amount} <-> ${token2Symbol} ${token2Amount}\n` +
                `交易: ${txHash}\n` +
                `DEX合约: ${swapLogs[0].address}`;

            console.log(message);
            await sendToTelegram(message);
            eventCount++;
            lastEventTime = Date.now();
        }
    } catch (error) {
        console.error("处理Swap日志时出错:", error.message);
    }
}

// 处理Transfer日志
async function processTransferLogs(transferLogs, txHash, sender) {
    try {
        // 检查是否有多个不同代币的转账
        const tokenAddresses = [...new Set(transferLogs.map(log => log.address.toLowerCase()))];

        if (tokenAddresses.length < 2) {
            return; // 只有一种代币，可能不是交换
        }

        // 分析发送方和接收方模式，识别可能的交换
        const transfersToUser = [];
        const transfersFromUser = [];

        for (const log of transferLogs) {
            if (!log.topics || log.topics.length < 3) continue;

            const from = ethers.getAddress("0x" + log.topics[1].slice(26)).toLowerCase();
            const to = ethers.getAddress("0x" + log.topics[2].slice(26)).toLowerCase();
            const tokenAddr = log.address.toLowerCase();

            if (to === sender) {
                // 用户接收了代币
                transfersToUser.push({
                    token: tokenAddr,
                    amount: log.data,
                    from: from
                });
            } else if (from === sender) {
                // 用户发送了代币
                transfersFromUser.push({
                    token: tokenAddr,
                    amount: log.data,
                    to: to
                });
            }
        }

        // 如果用户同时发送和接收了不同的代币，可能是交换
        if (transfersToUser.length > 0 && transfersFromUser.length > 0) {
            // 找到不同的代币
            const sentTokens = transfersFromUser.map(t => t.token);
            const receivedTokens = transfersToUser.map(t => t.token);

            // 检查是否发送和接收的是不同代币
            const differentTokens = sentTokens.some(st => !receivedTokens.includes(st)) ||
                receivedTokens.some(rt => !sentTokens.includes(rt));

            if (differentTokens) {
                // 很可能是交换
                // 获取代币详情（仅使用第一对不同的代币作为示例）
                const sentToken = transfersFromUser[0].token;
                const sentAmount = transfersFromUser[0].amount;
                const sentDecimals = await getTokenDecimals(sentToken, provider);
                const sentSymbol = await getTokenSymbol(sentToken, provider);

                const receivedToken = transfersToUser[0].token;
                const receivedAmount = transfersToUser[0].amount;
                const receivedDecimals = await getTokenDecimals(receivedToken, provider);
                const receivedSymbol = await getTokenSymbol(receivedToken, provider);

                // 格式化金额
                const formattedSentAmount = ethers.formatUnits(sentAmount, sentDecimals);
                const formattedReceivedAmount = ethers.formatUnits(receivedAmount, receivedDecimals);

                // 构建消息
                const message = `Base链交易发现!\n` +
                    `用户: ${sender}\n` +
                    `${sentSymbol} ${formattedSentAmount} -> ${receivedSymbol} ${formattedReceivedAmount}\n` +
                    `交易: ${txHash}`;

                console.log(message);
                await sendToTelegram(message);
                eventCount++;
                lastEventTime = Date.now();
            }
        }
    } catch (error) {
        console.error("处理Transfer日志时出错:", error.message);
    }
}

// 初始化和启动监视器
async function initialize() {
    console.log("\n初始化Base链监控器...");
    console.log("HTTP URL:", BASE_HTTP_URL);

    try {
        provider = new JsonRpcProvider(BASE_HTTP_URL);
        console.log("Provider初始化成功");

        // 获取当前区块作为起始点
        lastProcessedBlock = await provider.getBlockNumber();
        console.log("从区块 #" + lastProcessedBlock + " 开始监控");
        isConnected = true;

        // 开始轮询检查新区块
        pollBlocks();

        // 定期显示状态报告
        setInterval(() => {
            const timeSinceLastEvent = (Date.now() - lastEventTime) / 1000;
            console.log("\n--- 状态报告 ---");
            console.log("连接状态:", isConnected ? "已连接" : "未连接");
            console.log("处理的事件数:", eventCount);
            console.log(`最后处理的区块: ${lastProcessedBlock}`);
            console.log(`上次事件距现在: ${timeSinceLastEvent.toFixed(1)}秒`);
        }, 30000); // 每30秒显示一次状态报告

    } catch (error) {
        console.error("初始化失败:", error);
        console.error("5秒后重试...");
        setTimeout(initialize, 5000);
    }
}

// 启动监控
initialize().catch(error => {
    console.error("致命错误:", error);
    process.exit(1);
});

// 优雅退出
process.on('SIGINT', () => {
    console.log('\n正在关闭Base链监控器...');
    process.exit(0);
});

// 错误处理
process.on('unhandledRejection', (error) => {
    console.error('未处理的Promise拒绝:', error);
});

process.on('uncaughtException', (error) => {
    console.error('未捕获的异常:', error);
});
const { WebSocketProvider, ethers } = require("ethers");
const { wsUrl, KNOWN_TOKENS } = require('../utils/config');
const { parseV2Transaction, parseV3Transaction } = require('../utils/transaction');
const { pancake } = require('../utils/pancake');
const { sa } = require('../utils/smartAddress');
const { getTokenSymbol } = require('../utils/token');
const { analysis } = require('../utils/analysis');
const { formatBNBValue } = require('../utils/bnbvalue');

const { sendToTelegram, formatTransactionMessage } = require('../tgbot');

// 将智能钱包地址转换为小写形式的 Set
const smartAddresses = new Set(sa.map(addr => addr.toLowerCase()));

async function setupEventListeners() {
    provider.on("block", async (blockNumber) => {
        try {
            const block = await provider.getBlock(blockNumber);
            console.log(`\n检测到新区块: ${blockNumber}` + `  总交易数: ${block.transactions.length}`);

            const txPromises = block.transactions.map(txHash => provider.getTransaction(txHash));
            const transactions = await Promise.all(txPromises);

            // 解析每个tx
            for (const tx of transactions) {
                // 只看聪明钱包
                if (!smartAddresses.has(tx.from.toLowerCase())) {
                    // 纯转账
                    if (!tx.data || tx.data === '0x') {
                        const formattedValue = await formatBNBValue(tx.value, provider, tx.blockNumber);
                        const transferMsg = `\n [纯转账不调用合约：]${tx.from} 给 ${tx.to} 转了 ${formattedValue}`;
                        console.log(transferMsg);
                        await sendToTelegram(transferMsg);
                    }

                    // 得到函数签名
                    const methodId = tx.data.slice(0, 10);
                    // 看看是调用V2还是V3还是proxy
                    const knownContract = pancake[tx.to];

                    // 不一定找的到，目前只有pancake V2、3和V3Proxy的地址
                    if (knownContract) {
                        // 如果找到就看用的啥方法
                        const method = knownContract.methods[methodId];
                        if (!method) {
                            console.log(`\n在${knownContract.name}上没有找到这个function(函数签名)${methodId}`);
                            return;
                        }

                        // 如果找到了, 还需要具体解析每个function的动作
                        console.log(`\n聪明钱包 ${tx.from} 在 ${knownContract.name} 上`);
                        const headerMsg = `\n聪明钱包 ${tx.from} 在 ${knownContract.name} 上`;
                        console.log(headerMsg);

                        const analysisMsg = await analysis(tx, method, knownContract, provider);

                        const hashMsg = `交易哈希: ${tx.hash}`;
                        console.log(hashMsg);

                        // 组合完整消息并发送到 Telegram
                        const fullMessage = `${headerMsg}\n${analysisMsg}\n${hashMsg}`;
                        await sendToTelegram(fullMessage);
                        console.log(`交易哈希: ${tx.hash}`);

                    }
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
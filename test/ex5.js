const { WebSocketProvider, Interface } = require("ethers");
const ethers = require("ethers");
const { pancake } = require('../utils/pancake.js');  // 导入 Pancake 配置
const { sa } = require('../utils/smartAddress.js');  // 导入智能钱包地址
const { getTokenPrice, recordPair, analyzePriceChange, calculateReturn } = require('../utils/price.js');

// 将智能钱包地址转换为小写形式的 Set，方便查找
const smartAddresses = new Set(sa.map(addr => addr.toLowerCase()));


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

                    // 检查是否是聪明钱包的交易
                    if (!smartAddresses.has(tx.from.toLowerCase())) continue;

                    const methodId = tx.data.slice(0, 10);
                    const knownContract = pancake[tx.to];  // 使用导入的 pancake 配置

                    if (knownContract) {
                        const method = knownContract.methods[methodId];
                        if (!method) continue;

                        console.log(`\n聪明钱包 ${tx.from} 在 ${knownContract.name} 上调用了 ${method.name}`);
                        console.log(`交易哈希: ${tx.hash}`);


                        const iface = new Interface([method.interface]);
                        const decoded = iface.parseTransaction({ data: tx.data });

                        if (decoded) {
                            if (method.name === "swapExactTokensForTokens" || method.name === "swapExactTokensForTokensSupportingFeeOnTransferTokens") {
                                const inputTokenAddress = decoded.args[2][0];
                                const outputTokenAddress = decoded.args[2][decoded.args[2].length - 1];
                                const inputSymbol = await getTokenSymbol(inputTokenAddress);
                                const outputSymbol = await getTokenSymbol(outputTokenAddress);
                                const inputAmount = ethers.formatEther(decoded.args[0]);
                                const minOutputAmount = ethers.formatEther(decoded.args[1]);

                                // 记录交易对
                                const topPairs = recordPair(inputSymbol, outputSymbol);

                                // 获取价格和分析
                                const inputPrice = await getTokenPrice(inputTokenAddress, KNOWN_TOKENS["0x55d398326f99059fF775485246999027B3197955"], blockNumber, provider);
                                const outputPrice = await getTokenPrice(outputTokenAddress, KNOWN_TOKENS["0x55d398326f99059fF775485246999027B3197955"], blockNumber, provider);

                                // 获取价格变化
                                const priceChanges = await analyzePriceChange(inputTokenAddress, outputTokenAddress, blockNumber, provider);

                                // 计算收益率
                                if (inputPrice && outputPrice) {
                                    const expectedReturn = calculateReturn(
                                        parseFloat(inputAmount),
                                        inputPrice,
                                        parseFloat(minOutputAmount),
                                        outputPrice
                                    );

                                    console.log(`\n交易详情:`);
                                    console.log(`交易对: ${inputSymbol}/${outputSymbol}`);
                                    console.log(`输入: ${inputAmount} ${inputSymbol} (≈ $${(inputAmount * inputPrice).toFixed(2)})`);
                                    console.log(`最小输出: ${minOutputAmount} ${outputSymbol} (≈ $${(minOutputAmount * outputPrice).toFixed(2)})`);
                                    console.log(`预期收益率: ${expectedReturn.toFixed(2)}%`);

                                    if (priceChanges.length > 0) {
                                        console.log('\n价格变化:');
                                        priceChanges.forEach(({ block, price }) => {
                                            console.log(`区块 ${block}: ${price.toFixed(8)}`);
                                        });
                                    }

                                    console.log('\n热门交易对:');
                                    topPairs.forEach(([pair, count]) => {
                                        console.log(`${pair}: ${count}次`);
                                    });
                                }
                            } else if (knownContract.type === "DEX_V3" || knownContract.type === "DEX_V3_PROXY") {
                                // 处理 V3 交易
                                if (method.name === "exactInputSingle") {
                                    const params = decoded.args[0];
                                    const inputSymbol = await getTokenSymbol(params.tokenIn);
                                    const outputSymbol = await getTokenSymbol(params.tokenOut);
                                    console.log(`V3 交易: ${inputSymbol} -> ${outputSymbol}`);
                                    console.log(`输入金额: ${ethers.formatEther(params.amountIn)}`);
                                    console.log(`最小输出: ${ethers.formatEther(params.amountOutMinimum)}`);
                                    console.log(`费率: ${params.fee}`);
                                }
                                // 处理其他 V3 方法...
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
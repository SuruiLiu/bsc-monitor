// baseDebug.js - 调试Base链上的区块和交易数据结构
const { JsonRpcProvider } = require("ethers");

// Base链的HTTP RPC URL
const BASE_HTTP_URL = "https://base-mainnet.public.blastapi.io";
let provider;

async function inspectBlockStructure() {
    console.log("\n检查Base链上的数据结构");

    try {
        // 初始化Provider
        provider = new JsonRpcProvider(BASE_HTTP_URL);
        console.log("成功连接到Base链");

        // 获取当前区块
        const blockNumber = await provider.getBlockNumber();
        console.log(`当前区块高度: ${blockNumber}`);

        // 检查最近的区块数据结构
        for (let i = 0; i < 3; i++) {
            const targetBlock = blockNumber - i;
            console.log(`\n分析区块 #${targetBlock}:`);

            try {
                // 获取区块信息，包含交易信息
                const blockWithTxs = await provider.getBlock(targetBlock, true);

                if (!blockWithTxs) {
                    console.log(`无法获取区块 #${targetBlock}`);
                    continue;
                }

                console.log(`区块有 ${blockWithTxs.transactions.length} 笔交易`);

                // 检查交易结构
                if (blockWithTxs.transactions.length > 0) {
                    // 获取第一笔交易的详细信息
                    const firstTx = blockWithTxs.transactions[0];
                    console.log("\n第一笔交易的数据结构:");
                    console.log("交易哈希:", firstTx.hash);

                    // 输出交易对象的所有可用属性和值
                    console.log("交易数据结构:", Object.keys(firstTx));

                    // 获取交易收据
                    if (firstTx.hash) {
                        const receipt = await provider.getTransactionReceipt(firstTx.hash);
                        console.log("\n交易收据的数据结构:");
                        console.log("收据属性:", Object.keys(receipt));

                        // 检查日志结构
                        if (receipt.logs && receipt.logs.length > 0) {
                            const firstLog = receipt.logs[0];
                            console.log("\n第一个日志的数据结构:");
                            console.log("日志属性:", Object.keys(firstLog));
                            console.log("日志topics数量:", firstLog.topics ? firstLog.topics.length : 0);

                            if (firstLog.topics && firstLog.topics.length > 0) {
                                console.log("第一个topic (事件签名):", firstLog.topics[0]);
                            }
                        } else {
                            console.log("该交易没有日志");
                        }
                    }

                    // 检查是否有第二笔交易
                    if (blockWithTxs.transactions.length > 1) {
                        console.log("\n检查随机几笔交易的哈希:");
                        for (let j = 1; j < Math.min(5, blockWithTxs.transactions.length); j++) {
                            const tx = blockWithTxs.transactions[j];
                            console.log(`交易 #${j} 哈希:`, tx.hash || "无效哈希");
                        }
                    }
                }
            } catch (error) {
                console.error(`分析区块 #${targetBlock} 时出错:`, error.message);
            }
        }

    } catch (error) {
        console.error("发生错误:", error);
    }
}

// 执行分析
inspectBlockStructure().then(() => {
    console.log("\n分析完成");
    process.exit(0);
}).catch(error => {
    console.error("程序执行出错:", error);
    process.exit(1);
});
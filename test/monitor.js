const { ethers } = require("ethers");

// HTTP RPC URLs
const RPC_URLS = [
    "https://bsc-dataseed1.binance.org/",
    "https://bsc-dataseed2.binance.org/",
    "https://bsc-dataseed3.binance.org/",
    "https://bsc-dataseed4.binance.org/"
];

let currentRpcIndex = 0;
let provider = new ethers.JsonRpcProvider(RPC_URLS[currentRpcIndex]);

const targetAddresses = [
    "0xbf2499e4cda11eb33eea341ae425d85b6e93f028",
    "0xb04fd91a2bf70292c6c961232a37b0c1596f6bc2",
    "0x696223ca1ceadf80ee0e9cb05d5f0f39c71b7536",
    "0x8d73a36d78e2ae4a437053c9ce3be70d483ab74d",
    "0x6813cec8ae3b7b0f09d2db373711b99a5e0a7349",
    "0xa999171a1432c18ce403365acc2adfa5c2ec6091",
    "0xa9b809cfe8d95edbdd61603ba40081ba6da4f24b",
    "0x8df4a5527b19f4d6ca5e7bf1e243480a457813ce",
    "0x10d8f599ec37524ce6fab8db33b67c4e7080cc5c",
    "0xa65a2e8fd80d8af7cada920ab74966aad94da15f",
    "0x384d34692ee458711d0189164aca9a42693f8af0",
    "0x1a767ca9db9d2c6eafed3682b9db662725e70e69",
    "0x28dbdf586af5df30b2be07ebd5abc589dd3ab1b7",
    "0xbe01ca338ce5272e0ee3985643fef921231ef96a",
    "0x4521a15102e89af1795eeda7a78e472210955015"
].map(addr => addr.toLowerCase());

let eventCount = 0;
let lastEventTime = Date.now();
let lastProcessedBlock = 0;

// 延时函数
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// 切换 RPC
async function switchRPC() {
    currentRpcIndex = (currentRpcIndex + 1) % RPC_URLS.length;
    console.log(`切换到 RPC ${currentRpcIndex + 1}/${RPC_URLS.length}: ${RPC_URLS[currentRpcIndex]}`);
    provider = new ethers.JsonRpcProvider(RPC_URLS[currentRpcIndex]);
    await sleep(1000); // 等待连接建立
}

// 处理单个交易
async function processTx(txHash) {
    try {
        const tx = await provider.getTransaction(txHash);
        if (!tx) return;

        const receipt = await provider.getTransactionReceipt(txHash);
        if (!receipt) return;

        // 检查交易是否涉及目标地址
        const toAddress = tx.to ? tx.to.toLowerCase() : null;
        if (targetAddresses.includes(toAddress)) {
            console.log(`\n发现目标地址交易:`);
            console.log(`交易哈希: ${tx.hash}`);
            console.log(`发送方: ${tx.from}`);
            console.log(`接收方: ${tx.to}`);
            console.log(`数值: ${ethers.formatEther(tx.value)} BNB`);

            // 分析交易日志
            for (const log of receipt.logs) {
                // 检查 Transfer 事件
                if (log.topics[0] === ethers.id("Transfer(address,address,uint256)")) {
                    eventCount++;
                    lastEventTime = Date.now();
                    const from = `0x${log.topics[1].slice(26)}`;
                    const to = `0x${log.topics[2].slice(26)}`;
                    const value = ethers.formatUnits(log.data, 18);
                    console.log('\n发现 Transfer 事件:');
                    console.log(`  From: ${from}`);
                    console.log(`  To: ${to}`);
                    console.log(`  Value: ${value}`);
                }

                // 检查 Swap 事件
                if (log.topics[0] === ethers.id("Swap(address,uint256,uint256,uint256,uint256,address)")) {
                    const swapInterface = new ethers.Interface([
                        "event Swap(address indexed sender, uint256 amount0In, uint256 amount1In, uint256 amount0Out, uint256 amount1Out, address indexed to)"
                    ]);
                    try {
                        const decodedLog = swapInterface.parseLog(log);
                        console.log('\n发现 Swap 事件:');
                        console.log(`  发送方: ${decodedLog.args.sender}`);
                        console.log(`  接收方: ${decodedLog.args.to}`);
                        console.log(`  amount0In: ${ethers.formatUnits(decodedLog.args.amount0In, 18)}`);
                        console.log(`  amount1In: ${ethers.formatUnits(decodedLog.args.amount1In, 18)}`);
                        console.log(`  amount0Out: ${ethers.formatUnits(decodedLog.args.amount0Out, 18)}`);
                        console.log(`  amount1Out: ${ethers.formatUnits(decodedLog.args.amount1Out, 18)}`);
                    } catch (error) {
                        console.log("无法解析 Swap 事件:", error.message);
                    }
                }
            }
        }
    } catch (error) {
        if (error.message.includes('rate') || error.message.includes('limit')) {
            throw error; // 让上层处理速率限制错误
        }
        console.error(`处理交易出错: ${error.message}`);
    }
}

// 处理区块
async function processBlock(blockNumber) {
    try {
        const block = await provider.getBlock(blockNumber, true);
        if (!block || !block.transactions) {
            console.log(`区块 ${blockNumber} 数据不完整，跳过`);
            return;
        }

        console.log(`\n处理区块 ${blockNumber} (${block.transactions.length} 笔交易)`);

        // 每处理5个交易后暂停一下，避免速率限制
        for (let i = 0; i < block.transactions.length; i++) {
            try {
                await processTx(block.transactions[i]);
                if (i > 0 && i % 5 === 0) {
                    await sleep(1000);
                }
            } catch (error) {
                if (error.message.includes('rate') || error.message.includes('limit')) {
                    console.log('触发速率限制，切换 RPC...');
                    await switchRPC();
                    i--; // 重试当前交易
                    continue;
                }
            }
        }
    } catch (error) {
        console.error(`处理区块出错: ${error.message}`);
        if (error.message.includes('rate') || error.message.includes('limit')) {
            await switchRPC();
        }
    }
}

async function startMonitoring() {
    console.log('开始监控...');

    try {
        // 获取初始区块
        lastProcessedBlock = await provider.getBlockNumber();
        console.log(`当前区块: ${lastProcessedBlock}`);

        // 每3秒检查新区块
        setInterval(async () => {
            try {
                const currentBlock = await provider.getBlockNumber();
                if (currentBlock > lastProcessedBlock) {
                    // 只处理最新的区块
                    await processBlock(currentBlock);
                    lastProcessedBlock = currentBlock;
                }
            } catch (error) {
                console.error("检查新区块时出错:", error.message);
                if (error.message.includes('rate') || error.message.includes('limit')) {
                    await switchRPC();
                }
            }
        }, 3000);

        // 状态报告
        setInterval(() => {
            const timeSinceLastEvent = (Date.now() - lastEventTime) / 1000;
            console.log(`\n状态报告:`);
            console.log(`当前区块: ${lastProcessedBlock}`);
            console.log(`已处理事件数: ${eventCount}`);
            console.log(`距离上次事件: ${timeSinceLastEvent.toFixed(1)}秒`);
        }, 30000);
    } catch (error) {
        console.error("启动监控失败:", error.message);
        process.exit(1);
    }
}

// 启动监控
startMonitoring().catch(console.error);

// 优雅退出
process.on('SIGINT', () => {
    console.log('\n正在关闭监控...');
    process.exit(0);
});
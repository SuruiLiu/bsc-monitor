const { WebSocketProvider, ethers } = require("ethers");
const { wsUrl } = require('./utils/config');
const { sa } = require('./utils/smartAddress');
const { getTokenDecimals } = require('./utils/token');
const { sendToTelegram, formatMessage } = require('./tgbot');

let provider;
let isConnected = false;
let eventCount = 0;
let lastEventTime = Date.now();

// 将智能钱包地址转换为小写形式的 Set 以提高查询效率
const smartAddresses = new Set(sa.map(addr => addr.toLowerCase()));

// Transfer 事件的签名
const TRANSFER_EVENT_SIG = ethers.id("Transfer(address,address,uint256)");

async function setupEventListeners() {
    console.log("\n开始设置事件监听器...");
    console.log("使用的 WebSocket URL:", wsUrl);
    console.log("监听的地址数量:", smartAddresses.size);

    try {
        // 测试连接
        const blockNumber = await provider.getBlockNumber();
        console.log("当前区块高度:", blockNumber);
        isConnected = true;

        const filter = {
            topics: [TRANSFER_EVENT_SIG]
        };

        console.log("设置 Transfer 事件过滤器...");

        provider.on(filter, async (log) => {
            try {
                // 首先验证 log 和 topics 的格式
                if (!log || !log.topics || log.topics.length < 3 ||
                    !log.topics[1] || !log.topics[2] ||
                    log.topics[1].length < 26 || log.topics[2].length < 26) {
                    // console.log("跳过无效的事件格式");  // 如果需要调试可以打开这行
                    return;  // 直接跳过这个事件，继续监听下一个
                }

                eventCount++;
                lastEventTime = Date.now();
                // console.log(`\n收到事件 #${eventCount}`);

                // 从 topics 解析出 from 和 to 地址
                const fromAddress = ethers.getAddress("0x" + log.topics[1].slice(26)).toLowerCase();
                const toAddress = ethers.getAddress("0x" + log.topics[2].slice(26)).toLowerCase();

                // 检查是否是我们关注的地址
                if (smartAddresses.has(fromAddress) || smartAddresses.has(toAddress)) {
                    const value = ethers.formatUnits(log.data, 18);

                    // 格式化消息
                    const message = await formatMessage(log, fromAddress, toAddress, value, smartAddresses, provider);

                    // 发送到 Telegram
                    await sendToTelegram(message);

                    // 控制台也显示
                    console.log(message);
                }
            } catch (err) {
                console.error("处理 Transfer 事件时出错:", err);
                return;
            }
        });

        // 监听普通区块事件以验证连接存活
        provider.on("block", (blockNumber) => {
            console.log(`\n新区块: ${blockNumber}`);
            isConnected = true;
        });

        provider.websocket.on("open", () => {
            console.log("WebSocket 连接已打开");
            isConnected = true;
        });

        provider.websocket.on("error", async (err) => {
            console.error("WebSocket 错误:", err.message);
            isConnected = false;
            await reconnect();
        });

        provider.websocket.on("close", async () => {
            console.error("WebSocket 连接关闭");
            isConnected = false;
            await reconnect();
        });

        // 定期检查连接状态
        setInterval(async () => {
            try {
                const timeSinceLastEvent = (Date.now() - lastEventTime) / 1000;
                console.log("\n--- 状态报告 ---");
                console.log("连接状态:", isConnected ? "已连接" : "未连接");
                console.log("已处理事件数:", eventCount);
                console.log(`距离上次事件: ${timeSinceLastEvent.toFixed(1)}秒`);

                // 如果超过30秒没有事件，尝试获取区块号来验证连接
                if (timeSinceLastEvent > 30) {
                    const blockNumber = await provider.getBlockNumber();
                    console.log("连接测试 - 当前区块:", blockNumber);
                }
            } catch (error) {
                console.error("状态检查失败:", error.message);
                isConnected = false;
                await reconnect();
            }
        }, 10000); // 每10秒检查一次

    } catch (error) {
        console.error("设置事件监听器时出错:", error);
        throw error;
    }
}

async function reconnect() {
    console.log("\n开始重连...");
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
        console.log("重连成功");
    } catch (error) {
        console.error("重连失败:", error.message);
        setTimeout(reconnect, 1000);
    }
}

async function initialize() {
    console.log("\n开始初始化...");
    try {
        provider = new WebSocketProvider(wsUrl);
        await setupEventListeners();
    } catch (error) {
        console.error("初始化失败:", error);
        await reconnect();
    }
}

// 启动监控
initialize().catch(console.error);

// 优雅退出
process.on('SIGINT', () => {
    console.log('\n正在关闭监控...');
    if (provider) {
        provider.removeAllListeners();
        if (provider.websocket) {
            provider.websocket.close();
        }
    }
    process.exit(0);
});

// 处理未捕获的错误
process.on('unhandledRejection', (error) => {
    console.error('未捕获的 Promise 错误:', error);
});

process.on('uncaughtException', (error) => {
    console.error('未捕获的异常:', error);
});
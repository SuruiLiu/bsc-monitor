const { WebSocketProvider } = require("ethers");

// 连接状态跟踪
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY = 1000; // 1秒

async function setupProvider(url, blockHandler) {
    try {
        const provider = new WebSocketProvider(url);

        // 设置事件监听器
        provider.on("block", async (blockNumber) => {
            try {
                await blockHandler(blockNumber, provider);
            } catch (error) {
                console.error("处理区块时出错:", error);
            }
        });

        // 设置 WebSocket 错误处理
        provider.websocket.on("error", async (err) => {
            console.error("WebSocket 错误:", err);
            await handleConnectionError(provider, url, blockHandler);
        });

        provider.websocket.on("close", async () => {
            console.error("WebSocket 连接关闭");
            await handleConnectionError(provider, url, blockHandler);
        });

        reconnectAttempts = 0; // 重置重连计数
        return provider;
    } catch (error) {
        console.error("设置提供者失败:", error);
        throw error;
    }
}

async function handleConnectionError(provider, url, blockHandler) {
    reconnectAttempts++;
    if (reconnectAttempts > MAX_RECONNECT_ATTEMPTS) {
        console.error(`达到最大重连次数 (${MAX_RECONNECT_ATTEMPTS})`);
        process.exit(1);
    }

    console.log(`尝试重连 (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);
    await reconnect(provider, url, blockHandler);
}

async function reconnect(provider, url, blockHandler) {
    try {
        if (provider) {
            provider.removeAllListeners();
            provider = null;
        }

        // 等待一段时间后重连
        await new Promise(resolve => setTimeout(resolve, RECONNECT_DELAY));

        // 创建新的连接
        provider = await setupProvider(url, blockHandler);
        console.log("重连成功");
        return provider;
    } catch (error) {
        console.error("重连失败:", error);
        // 递归重试
        setTimeout(() => reconnect(provider, url, blockHandler), RECONNECT_DELAY);
    }
}

module.exports = {
    setupProvider,
    reconnect
};
解释一下每个工具文件的作用：
## config.js: 配置文件，存储基础配置信息

- WebSocket 连接地址
- 常用代币地址和符号的映射


## connections.js: 处理 WebSocket 连接相关的逻辑(已删除)

- 设置 WebSocket 提供者
- 处理连接错误和重连机制
- 维护连接状态


## pancake.js: PancakeSwap 合约和方法配置

- V2 和 V3 路由合约地址及其方法
- 每个方法的 ABI 接口定义
- 包括代理合约的映射


## price.js: 价格相关的功能

- V2 和 V3 的价格查询逻辑
- 交易对缓存和价格缓存
- 分析价格变化和计算收益


## smartAddress.js: 存储要监控的智能钱包地址列表


## token.js: 代币相关功能
- 获取代币符号
- 缓存代币信息


## transaction.js: 交易解析逻辑

- 解析 V2 和 V3 的不同类型交易
- 提取交易信息和参数




// tgbot.js
const TelegramBot = require('node-telegram-bot-api');

const { getTokenPrice, getV3TokenPrice } = require('./utils/price');
const { getTokenSymbol } = require('./utils/token');

// 使用你的 bot token
const token = '7940412401:AAHTg443PceeL593oz07IhAxZK0gqETguFM';

// 创建 bot 实例
const bot = new TelegramBot(token, { polling: true });

// 定义目标聊天 ID（你可以设置为特定的聊天组或频道）
const CHAT_ID = '-1002379529813';  // 你需要替换为实际的聊天 ID

// 美化消息格式
// 格式化消息
// WBNB 地址
const WBNB = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c";

async function formatMessage(log, fromAddress, toAddress, value, smartAddresses, provider) {
    try {
        // 获取代币符号
        const tokenSymbol = await getTokenSymbol(log.address, provider);

        let message = `🔔 <b>智能钱包交易提醒</b>\n\n`;

        // 添加交易类型
        if (smartAddresses.has(fromAddress) && smartAddresses.has(toAddress)) {
            message += `📤 类型: 智能钱包互转\n`;
        } else if (smartAddresses.has(fromAddress)) {
            message += `📤 类型: 智能钱包转出\n`;
        } else {
            message += `📥 类型: 智能钱包收款\n`;
        }

        message += `\n`;
        message += `💰 金额: ${value} ${tokenSymbol}\n`;
        message += `🔑 代币: ${log.address}\n`;
        message += `\n`;
        message += `📤 From: <code>${fromAddress}</code>\n`;
        message += `📥 To: <code>${toAddress}</code>\n`;
        message += `\n`;
        message += `🔗 交易: ${log.transactionHash}\n`;
        message += `📦 区块: ${log.blockNumber}\n`;

        return message;
    } catch (error) {
        console.error("格式化消息时出错:", error);
        // 如果出错，返回基本信息
        let message = `🔔 <b>智能钱包交易提醒</b>\n\n`;
        message += `💰 金额: ${value}\n`;
        message += `📤 From: ${fromAddress}\n`;
        message += `📥 To: ${toAddress}\n`;
        message += `🔗 Hash: ${log.transactionHash}\n`;
        return message;
    }
}
async function sendToTelegram(message) {
    try {
        await bot.sendMessage(CHAT_ID, message, {
            parse_mode: 'HTML',
            disable_web_page_preview: true
        });
    } catch (error) {
        console.error('发送 Telegram 消息失败:', error);
    }
}

module.exports = {
    sendToTelegram,
    formatMessage
};
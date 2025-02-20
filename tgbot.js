// tgbot.js
const TelegramBot = require('node-telegram-bot-api');
const { sa, getWalletName } = require('./utils/smartAddress');
const { getTokenPrice, getV3TokenPrice } = require('./utils/price');
const { getTokenSymbol } = require('./utils/token');
require('dotenv').config();

// 使用你的 bot token
const token = process.env.TOKEN;

// 创建 bot 实例
const bot = new TelegramBot(token, { polling: true });

// 定义目标聊天 ID（你可以设置为特定的聊天组或频道）
const CHAT_ID = process.env.CHAT_ID;  // 你需要替换为实际的聊天 ID

// 美化消息格式
// 格式化消息
// WBNB 地址
const WBNB = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c";

async function formatMessage(log, fromAddress, toAddress, value, smartAddresses, provider) {
    try {
        const tokenSymbol = await getTokenSymbol(log.address, provider);
        const walletName = getWalletName(fromAddress);
        let message = '';

        if (smartAddresses.has(fromAddress)) {
            // 转出消息格式
            message = `🔔 ${walletName}动向\n`;
            message += `${walletName}\n`;
            message += `${fromAddress}\n`;
            message += `💰 操作:\n`;
            message += `使用 ${value} BNB\n`;
            message += `买入 ${tokenSymbol}\n`;
            message += `🔑 代币:\n`;
            message += `https://bscscan.com/address/${log.address}\n`;
            message += `🔗 交易tx:\n`;
            message += `https://bscscan.com/tx/${log.transactionHash}`;
        } else {
            // 收款消息格式
            const receiverName = getWalletName(toAddress);
            message = `🔔 ${receiverName}动向\n`;
            message += `${receiverName}\n`;
            message += `${toAddress}\n`;
            message += `💰 操作:\n`;
            message += `收到 ${value} ${tokenSymbol}\n`;
            message += `来自地址: ${fromAddress}\n`;
            message += `🔑 代币:\n`;
            message += `https://bscscan.com/address/${log.address}\n`;
            message += `🔗 交易tx:\n`;
            message += `https://bscscan.com/tx/${log.transactionHash}`;
        }

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
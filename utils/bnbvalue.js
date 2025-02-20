const { ethers } = require("ethers");

// WBNB 地址
const WBNB_ADDRESS = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c";

async function formatBNBValue(weiValue, provider, blockNumber) {
    try {
        // 将 Wei 转换为 BNB
        const bnbValue = Number(ethers.formatEther(weiValue));

        // 格式化显示函数
        function formatNumber(value) {
            if (value < 0.001) {
                return value.toExponential(4);
            }
            return value.toFixed(4);
        }

        // 直接格式化 BNB 值
        const bnbFormatted = formatNumber(bnbValue);

        return `${bnbFormatted} BNB`;
    } catch (error) {
        console.error("Error formatting BNB value:", error);
        return "Invalid value";
    }
}


module.exports = { formatBNBValue };
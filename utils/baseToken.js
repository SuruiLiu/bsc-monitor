const { ethers } = require("ethers");
const { BASE_KNOWN_TOKENS } = require('./config');

const tokenSymbolCache = new Map();
const tokenDecimalsCache = new Map();

const ERC20_ABI = [
    "function symbol() view returns (string)",
    "function decimals() view returns (uint8)"
];

const WETH_ADDRESS = "0x4200000000000000000000000000000000000006";

async function getTokenSymbol(address, provider) {
    if (BASE_KNOWN_TOKENS && BASE_KNOWN_TOKENS[address]) {
        return BASE_KNOWN_TOKENS[address];
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

async function getTokenDecimals(tokenAddress, provider) {
    // 转换为小写进行比较
    const addressLower = tokenAddress.toLowerCase();

    if (addressLower === WETH_ADDRESS.toLowerCase()) {
        return 18;
    }

    if (tokenDecimalsCache.has(addressLower)) {
        return tokenDecimalsCache.get(addressLower);
    }

    try {
        const contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
        const decimals = await contract.decimals();
        tokenDecimalsCache.set(addressLower, decimals);
        return decimals;
    } catch (error) {
        console.error(`获取代币 ${tokenAddress} 小数位失败:`, error.message);
        return 18; // 默认返回 18
    }
}

module.exports = {
    getTokenSymbol,
    getTokenDecimals,
    WETH_ADDRESS
};
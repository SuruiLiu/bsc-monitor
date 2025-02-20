const { ethers } = require("ethers");
const { KNOWN_TOKENS } = require('./config');
const tokenSymbolCache = new Map();
const ERC20_ABI = ["function symbol() view returns (string)"];

async function getTokenSymbol(address, provider) {
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

async function getTokenDecimals(tokenAddress, provider) {
    try {
        // 如果是 WBNB，直接返回 18
        if (tokenAddress.toLowerCase() === WBNB.toLowerCase()) {
            return 18;
        }

        const abi = ["function decimals() view returns (uint8)"];
        const contract = new ethers.Contract(tokenAddress, abi, provider);
        return await contract.decimals();
    } catch (error) {
        console.error("获取代币小数位失败:", error);
        return 18; // 默认返回 18
    }
}

module.exports = { getTokenSymbol, getTokenDecimals };
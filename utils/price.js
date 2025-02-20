const { ethers } = require("ethers");

const PANCAKE_FACTORY_ADDRESS = "0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73";
const PANCAKE_FACTORY_ABI = [
    "function getPair(address tokenA, address tokenB) view returns (address pair)"
];
const PANCAKE_PAIR_ABI = [
    "function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)"
];

// 缓存
const pairCache = new Map();
const priceCache = new Map();
const pairFrequency = new Map();

async function getPairAddress(token0, token1, provider) {
    const key = `${token0}-${token1}`;
    if (pairCache.has(key)) return pairCache.get(key);

    const factory = new ethers.Contract(PANCAKE_FACTORY_ADDRESS, PANCAKE_FACTORY_ABI, provider);
    const pairAddress = await factory.getPair(token0, token1);
    pairCache.set(key, pairAddress);
    return pairAddress;
}

async function getTokenPrice(tokenAddress, baseTokenAddress, blockNumber, provider) {
    const key = `${tokenAddress}-${baseTokenAddress}-${blockNumber}`;
    if (priceCache.has(key)) return priceCache.get(key);

    try {
        const pairAddress = await getPairAddress(tokenAddress, baseTokenAddress, provider);
        const pair = new ethers.Contract(pairAddress, PANCAKE_PAIR_ABI, provider);

        const reserves = await pair.getReserves({ blockTag: blockNumber });
        const price = reserves[0] / reserves[1];
        priceCache.set(key, price);
        return price;
    } catch (error) {
        console.error(`获取价格失败: ${error.message}`);
        return null;
    }
}

function recordPair(token0Symbol, token1Symbol) {
    const pair = `${token0Symbol}/${token1Symbol}`;
    pairFrequency.set(pair, (pairFrequency.get(pair) || 0) + 1);
    return [...pairFrequency.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
}

async function analyzePriceChange(inputToken, outputToken, blockNumber, provider) {
    const priceChanges = [];
    for (let i = -3; i <= 3; i++) {
        const targetBlock = blockNumber + i;
        const price = await getTokenPrice(inputToken, outputToken, targetBlock, provider);
        if (price) {
            priceChanges.push({ block: targetBlock, price });
        }
    }
    return priceChanges;
}

function calculateReturn(inputAmount, inputPrice, outputAmount, outputPrice) {
    const inputValue = inputAmount * inputPrice;
    const outputValue = outputAmount * outputPrice;
    return (outputValue / inputValue - 1) * 100;
}
// V3 相关常量
const PANCAKE_V3_FACTORY = "0x13f4EA83D0bd40E75C8222255bc855a974568Dd4";
const PANCAKE_V3_FACTORY_ABI = [
    "function getPool(address tokenA, address tokenB, uint24 fee) view returns (address pool)"
];
const PANCAKE_V3_POOL_ABI = [
    "function token0() external view returns (address)",
    "function token1() external view returns (address)",
    "function fee() external view returns (uint24)",
    "function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)",
    "function liquidity() external view returns (uint128)"
];

// V3 Pool 缓存
const v3PoolCache = new Map();

// 获取 V3 Pool 地址
async function getV3PoolAddress(token0, token1, fee, provider) {
    const key = `${token0}-${token1}-${fee}`;
    if (v3PoolCache.has(key)) return v3PoolCache.get(key);

    const factory = new ethers.Contract(PANCAKE_V3_FACTORY, PANCAKE_V3_FACTORY_ABI, provider);
    const poolAddress = await factory.getPool(token0, token1, fee);
    v3PoolCache.set(key, poolAddress);
    return poolAddress;
}

// V3 价格计算函数
async function getV3TokenPrice(tokenIn, tokenOut, fee, blockNumber, provider) {
    const key = `v3-${tokenIn}-${tokenOut}-${fee}-${blockNumber}`;
    if (priceCache.has(key)) return priceCache.get(key);

    try {
        const poolAddress = await getV3PoolAddress(tokenIn, tokenOut, fee, provider);
        if (poolAddress === ethers.ZeroAddress) return null;

        const pool = new ethers.Contract(poolAddress, PANCAKE_V3_POOL_ABI, provider);
        const [slot0, token0, token1] = await Promise.all([
            pool.slot0({ blockTag: blockNumber }),
            pool.token0(),
            pool.token1()
        ]);

        const sqrtPriceX96 = slot0.sqrtPriceX96;
        const price = calculateV3Price(sqrtPriceX96, tokenIn === token0);
        priceCache.set(key, price);
        return price;
    } catch (error) {
        console.error(`获取 V3 价格失败: ${error.message}`);
        return null;
    }
}

// 计算 V3 价格
function calculateV3Price(sqrtPriceX96, isToken0) {
    const Q96 = ethers.BigInt('0x1000000000000000000000000');
    const price = (sqrtPriceX96 * sqrtPriceX96) / Q96;
    return isToken0 ? 1 / Number(price) : Number(price);
}

module.exports = {
    getTokenPrice,
    getV3TokenPrice,  // 导出 V3 价格查询函数
    recordPair,
    analyzePriceChange,
    calculateReturn
};
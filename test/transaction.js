const { Interface } = require("ethers");
const { getTokenSymbol } = require('../utils/token');
const { getTokenPrice, recordPair, analyzePriceChange, calculateReturn } = require('../utils/price');
const { KNOWN_TOKENS } = require('../utils/config');

// 解析 V2 交易
async function parseV2Transaction(tx, decoded, method, provider) {
    try {
        if (method.name === "swapExactTokensForTokens" ||
            method.name === "swapExactTokensForTokensSupportingFeeOnTransferTokens") {

            const inputTokenAddress = decoded.args[2][0];
            const outputTokenAddress = decoded.args[2][decoded.args[2].length - 1];
            const inputSymbol = await getTokenSymbol(inputTokenAddress, provider);
            const outputSymbol = await getTokenSymbol(outputTokenAddress, provider);
            const inputAmount = ethers.formatEther(decoded.args[0]);
            const minOutputAmount = ethers.formatEther(decoded.args[1]);

            // 记录交易对
            const topPairs = recordPair(inputSymbol, outputSymbol);

            // 获取价格和分析
            const inputPrice = await getTokenPrice(
                inputTokenAddress,
                KNOWN_TOKENS["0x55d398326f99059fF775485246999027B3197955"],
                tx.blockNumber,
                provider
            );
            const outputPrice = await getTokenPrice(
                outputTokenAddress,
                KNOWN_TOKENS["0x55d398326f99059fF775485246999027B3197955"],
                tx.blockNumber,
                provider
            );

            return {
                type: 'V2_SWAP',
                data: {
                    inputToken: {
                        address: inputTokenAddress,
                        symbol: inputSymbol,
                        amount: inputAmount,
                        price: inputPrice
                    },
                    outputToken: {
                        address: outputTokenAddress,
                        symbol: outputSymbol,
                        amount: minOutputAmount,
                        price: outputPrice
                    },
                    priceChanges: await analyzePriceChange(
                        inputTokenAddress,
                        outputTokenAddress,
                        tx.blockNumber,
                        provider
                    ),
                    topPairs,
                    expectedReturn: inputPrice && outputPrice ?
                        calculateReturn(
                            parseFloat(inputAmount),
                            inputPrice,
                            parseFloat(minOutputAmount),
                            outputPrice
                        ) : null
                }
            };
        }
    } catch (error) {
        console.error(`解析 V2 交易失败: ${error.message}`);
        return null;
    }
}

// 解析 V3 交易
async function parseV3Transaction(tx, decoded, method, provider) {
    try {
        if (method.name === "exactInputSingle") {
            const params = decoded.args[0];
            const inputSymbol = await getTokenSymbol(params.tokenIn, provider);
            const outputSymbol = await getTokenSymbol(params.tokenOut, provider);

            return {
                type: 'V3_EXACT_INPUT_SINGLE',
                data: {
                    inputToken: {
                        address: params.tokenIn,
                        symbol: inputSymbol,
                        amount: ethers.formatEther(params.amountIn)
                    },
                    outputToken: {
                        address: params.tokenOut,
                        symbol: outputSymbol,
                        amount: ethers.formatEther(params.amountOutMinimum)
                    },
                    fee: params.fee,
                    recipient: params.recipient
                }
            };
        }
        // 可以添加其他 V3 方法的处理
    } catch (error) {
        console.error(`解析 V3 交易失败: ${error.message}`);
        return null;
    }
}

module.exports = {
    parseV2Transaction,
    parseV3Transaction
};
const { getTokenSymbol } = require('../utils/token');

// 工具函数：格式化数值（考虑小数位数）
function formatAmount(amount, decimals = 18) {
    const bigintValue = BigInt(amount);
    return Number(bigintValue) / Math.pow(10, decimals);
}

// 工具函数：解析十六进制数据
function decodeHexValue(hex) {
    return BigInt(hex);
}

// 工具函数：解析地址数组
function decodeAddressArray(hex) {
    const data = hex.slice(10);
    const addresses = [];
    for (let i = 0; i < data.length; i += 64) {
        addresses.push('0x' + data.slice(i + 24, i + 64));
    }
    return addresses;
}

// 解析交易数据的主函数
async function analysis(tx, method, knownContract, provider) {
    let message = '';
    switch (knownContract.type) {
        case 'DEX':
            message = await handleV2Transaction(tx, method, provider);
            break;
        case 'DEX_V3':
        case 'DEX_V3_PROXY':
            message = await handleV3Transaction(tx, method, provider);
            break;
        default:
            message = '未知的合约类型';
            console.log(message);
    }
    return message;
}

// 修改 V2 处理函数返回消息
async function handleV2Transaction(tx, method, provider) {
    const inputData = tx.data;
    let message = '';

    switch (method.name) {
        case 'swapExactETHForTokens': {
            const amountOutMin = decodeHexValue('0x' + inputData.slice(10, 74));
            const path = decodeAddressArray(inputData);
            const toAddress = '0x' + inputData.slice(154, 194);
            const outputTokenSymbol = await getTokenSymbol(path[path.length - 1], provider);

            message = `用 ${formatAmount(tx.value)} BNB 购买 ${outputTokenSymbol} 代币\n` +
                `期望最少获得: ${formatAmount(amountOutMin)} ${outputTokenSymbol}\n` +
                `接收地址: ${toAddress}`;

            console.log(message.split('\n').join('\n'));
            break;
        }

        case 'swapETHForExactTokens': {
            const amountOut = decodeHexValue('0x' + inputData.slice(10, 74));
            const path = decodeAddressArray(inputData);
            const toAddress = '0x' + inputData.slice(154, 194);
            const outputTokenSymbol = await getTokenSymbol(path[path.length - 1], provider);

            message = `用最多 ${formatAmount(tx.value)} BNB 购买 ${formatAmount(amountOut)} ${outputTokenSymbol}\n` +
                `接收地址: ${toAddress}`;

            console.log(message.split('\n').join('\n'));
            break;
        }

        case 'swapExactTokensForTokens': {
            const amountIn = decodeHexValue('0x' + inputData.slice(10, 74));
            const amountOutMin = decodeHexValue('0x' + inputData.slice(74, 138));
            const path = decodeAddressArray(inputData);
            const toAddress = '0x' + inputData.slice(inputData.length - 40);

            const [inputTokenSymbol, outputTokenSymbol] = await Promise.all([
                getTokenSymbol(path[0], provider),
                getTokenSymbol(path[path.length - 1], provider)
            ]);

            message = `用 ${formatAmount(amountIn)} ${inputTokenSymbol} 换取 ${outputTokenSymbol} 代币\n` +
                `期望最少获得: ${formatAmount(amountOutMin)} ${outputTokenSymbol}\n` +
                `接收地址: ${toAddress}`;

            console.log(message.split('\n').join('\n'));
            break;
        }

        case 'swapTokensForExactTokens': {
            const amountOut = decodeHexValue('0x' + inputData.slice(10, 74));
            const amountInMax = decodeHexValue('0x' + inputData.slice(74, 138));
            const path = decodeAddressArray(inputData);
            const toAddress = '0x' + inputData.slice(inputData.length - 40);

            const [inputTokenSymbol, outputTokenSymbol] = await Promise.all([
                getTokenSymbol(path[0], provider),
                getTokenSymbol(path[path.length - 1], provider)
            ]);

            message = `用最多 ${formatAmount(amountInMax)} ${inputTokenSymbol} 换取 ${formatAmount(amountOut)} ${outputTokenSymbol}\n` +
                `接收地址: ${toAddress}`;

            console.log(message.split('\n').join('\n'));
            break;
        }

        case 'swapExactTokensForETH': {
            const amountIn = decodeHexValue('0x' + inputData.slice(10, 74));
            const amountOutMin = decodeHexValue('0x' + inputData.slice(74, 138));
            const path = decodeAddressArray(inputData);
            const toAddress = '0x' + inputData.slice(inputData.length - 40);

            const inputTokenSymbol = await getTokenSymbol(path[0], provider);

            message = `用 ${formatAmount(amountIn)} ${inputTokenSymbol} 换取 BNB\n` +
                `期望最少获得: ${formatAmount(amountOutMin)} BNB\n` +
                `接收地址: ${toAddress}`;

            console.log(message.split('\n').join('\n'));
            break;
        }

        case 'swapTokensForExactETH': {
            const amountOut = decodeHexValue('0x' + inputData.slice(10, 74));
            const amountInMax = decodeHexValue('0x' + inputData.slice(74, 138));
            const path = decodeAddressArray(inputData);
            const toAddress = '0x' + inputData.slice(inputData.length - 40);

            const inputTokenSymbol = await getTokenSymbol(path[0], provider);

            message = `用最多 ${formatAmount(amountInMax)} ${inputTokenSymbol} 换取 ${formatAmount(amountOut)} BNB\n` +
                `接收地址: ${toAddress}`;

            console.log(message.split('\n').join('\n'));
            break;
        }

        case 'swapExactTokensForETHSupportingFeeOnTransferTokens': {
            const amountIn = decodeHexValue('0x' + inputData.slice(10, 74));
            const amountOutMin = decodeHexValue('0x' + inputData.slice(74, 138));
            const path = decodeAddressArray(inputData);
            const toAddress = '0x' + inputData.slice(inputData.length - 40);

            const inputTokenSymbol = await getTokenSymbol(path[0], provider);

            message = `用 ${formatAmount(amountIn)} ${inputTokenSymbol}(带转账税) 换取 BNB\n` +
                `期望最少获得: ${formatAmount(amountOutMin)} BNB\n` +
                `接收地址: ${toAddress}`;

            console.log(message.split('\n').join('\n'));
            break;
        }

        default:
            message = '未知的 V2 方法';
            console.log(message);
    }

    return message;
}

// 修改 V3 处理函数返回消息
async function handleV3Transaction(tx, method, provider) {
    const inputData = tx.data;
    let message = '';

    switch (method.name) {
        case 'exactInputSingle': {
            const params = decodeV3Params(inputData);
            const [inputTokenSymbol, outputTokenSymbol] = await Promise.all([
                getTokenSymbol(params.tokenIn, provider),
                getTokenSymbol(params.tokenOut, provider)
            ]);

            message = `用 ${formatAmount(params.amountIn)} ${inputTokenSymbol} 换取 ${outputTokenSymbol}\n` +
                `最小获得: ${formatAmount(params.amountOutMinimum)} ${outputTokenSymbol}\n` +
                `接收地址: ${params.recipient}\n` +
                `费率: ${params.fee}`;

            console.log(message.split('\n').join('\n'));
            break;
        }

        case 'swapExactTokensForTokens':
        case 'swapExactTokensForTokensV2': {
            const amountIn = decodeHexValue('0x' + inputData.slice(10, 74));
            const amountOutMin = decodeHexValue('0x' + inputData.slice(74, 138));
            const path = decodeAddressArray(inputData);
            const toAddress = '0x' + inputData.slice(inputData.length - 40);

            const [inputTokenSymbol, outputTokenSymbol] = await Promise.all([
                getTokenSymbol(path[0], provider),
                getTokenSymbol(path[path.length - 1], provider)
            ]);

            message = `[V3] 用 ${formatAmount(amountIn)} ${inputTokenSymbol} 换取 ${outputTokenSymbol}\n` +
                `最小获得: ${formatAmount(amountOutMin)} ${outputTokenSymbol}\n` +
                `接收地址: ${toAddress}`;

            console.log(message.split('\n').join('\n'));
            break;
        }

        case 'exactInput': {
            const params = decodeV3ExactInputParams(inputData);
            message = `[V3-多跳] 用 ${formatAmount(params.amountIn)} 代币进行多跳交易\n` +
                `最小获得: ${formatAmount(params.amountOutMinimum)}\n` +
                `接收地址: ${params.recipient}`;

            console.log(message.split('\n').join('\n'));
            break;
        }

        case 'exactOutput': {
            const params = decodeV3ExactOutputParams(inputData);
            message = `[V3-多跳] 获取 ${formatAmount(params.amountOut)} 代币\n` +
                `最多支付: ${formatAmount(params.amountInMaximum)}\n` +
                `接收地址: ${params.recipient}`;

            console.log(message.split('\n').join('\n'));
            break;
        }

        case 'exactOutputSingle': {
            const params = decodeV3Params(inputData);
            const [inputTokenSymbol, outputTokenSymbol] = await Promise.all([
                getTokenSymbol(params.tokenIn, provider),
                getTokenSymbol(params.tokenOut, provider)
            ]);

            message = `[V3] 用 ${inputTokenSymbol} 换取 ${formatAmount(params.amountOut)} ${outputTokenSymbol}\n` +
                `最多支付: ${formatAmount(params.amountInMaximum)} ${inputTokenSymbol}\n` +
                `接收地址: ${params.recipient}\n` +
                `费率: ${params.fee}`;

            console.log(message.split('\n').join('\n'));
            break;
        }

        case 'multicallWithoutCheck': {
            const callsData = inputData.slice(10);
            message = `执行批量调用（无检查版本）\n` +
                `调用数据长度: ${callsData.length}`;

            console.log(message.split('\n').join('\n'));
            break;
        }

        default:
            message = '未知的 V3 方法';
            console.log(message);
    }

    return message;
}

// V3参数解析函数
function decodeV3Params(inputData) {
    return {
        tokenIn: '0x' + inputData.slice(34, 74),
        tokenOut: '0x' + inputData.slice(98, 138),
        fee: parseInt(inputData.slice(138, 202), 16),
        recipient: '0x' + inputData.slice(226, 266),
        amountIn: decodeHexValue('0x' + inputData.slice(266, 330)),
        amountOutMinimum: decodeHexValue('0x' + inputData.slice(330, 394)),
        sqrtPriceLimitX96: decodeHexValue('0x' + inputData.slice(394, 458))
    };
}

function decodeV3ExactInputParams(inputData) {
    return {
        path: inputData.slice(10, 74),
        recipient: '0x' + inputData.slice(98, 138),
        amountIn: decodeHexValue('0x' + inputData.slice(138, 202)),
        amountOutMinimum: decodeHexValue('0x' + inputData.slice(202, 266))
    };
}

function decodeV3ExactOutputParams(inputData) {
    return {
        path: inputData.slice(10, 74),
        recipient: '0x' + inputData.slice(98, 138),
        amountOut: decodeHexValue('0x' + inputData.slice(138, 202)),
        amountInMaximum: decodeHexValue('0x' + inputData.slice(202, 266))
    };
}

module.exports = { analysis };
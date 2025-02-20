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

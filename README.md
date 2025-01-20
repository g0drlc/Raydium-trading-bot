# 🚀 Raydium Trading Bots

A powerful trading bot that automates the process of sniping new token launches on Raydium. This bot evaluates potential tokens based on high-filter criteria and ensures early entry and strategic exits in the market. 📈💎

## Key Features 🌟

- **Token Sniping**: Automatically buys tokens at launch based on a set of criteria. 🎯
- **Advanced Filters**: Only trades tokens that meet strict conditions, including:
  - Minimum and maximum pool size 🏊‍♂️
  - Token liquidity pool (LP) is burned 🔥
  - Token mint is renounced 🚫
  - Token freezing capability 🧊
  - Top 10 holders’ token distribution 📊
- **Limit and Stop-Loss Orders**: Allows you to set custom sell conditions, including:
  - Profit percentage targets 💰
  - Stop loss limits to protect against market downturns ⚠️
- **Dynamic Liquidity Pool Tracking**: Continuously monitors pool size and token activity to ensure favorable trade conditions 🔍
- **Auto-Sell**: Automatically sells tokens based on predefined conditions 🔄
- **Fast Execution**: The bot places orders faster than most buyers, giving you a competitive edge ⚡

## How It Works 🔧

The bot works by connecting to the Solana blockchain, subscribing to transaction logs on Raydium, and monitoring liquidity pool changes. It uses advanced filtering to ensure only viable tokens are traded, preventing losses from unfavorable pools or token contracts.

### Trade Flow 🔄

1. **Filter Criteria**: The bot checks the token's pool size, liquidity status, mint status, and token holders' information. 📏
2. **Buy**: If the token passes the criteria, the bot places an initial buy order. 🛒
3. **Monitor**: The bot tracks the pool and token status to ensure the investment remains profitable. 📈
4. **Sell**: The bot sells the token once predefined conditions are met (e.g., price increase or stop loss). 💸
5. **Dynamic Conditions**: You can set custom buy amounts, stop loss, and sell percentages. 🛠️

## Installation 🛠️

### Prerequisites ⚡

- Node.js (v16 or higher) 💻
- Solana CLI (for Solana blockchain interaction) 🪙
- MongoDB (for data storage) 🗃️

### Setup ⚙️

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/raydium-trading-bots.git
   cd raydium-trading-bots
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up MongoDB and update the database configuration in `data.json`. 🛢️

4. Place your private key in `data.json` for wallet access. 🔑

5. Configure the bot by editing the parameters in `data.json` (e.g., minSize, maxSize, autoSell, etc.). ⚙️

6. Run the bot:
   ```bash
   npm run start
   ```

## Customization 🎨

You can modify various parameters such as:
- **Buy Amount**: The amount of token you want to buy per transaction. 💵
- **Profit Percent**: The profit threshold to trigger a sell action. 💲
- **Stop Loss**: The percentage at which to stop losses and sell the token. 🛑
- **Liquidity Pool Size**: Filter tokens based on minimum and maximum liquidity pool sizes. 📏

## Support 🆘

For issues or feature requests, open an issue on GitHub or contact the maintainer. 📬
📣 For technical queries, reach out on Telegram: [@g0drlc](https://t.me/g0drlc). 


## Contributing 💡

Feel free to fork this project and submit pull requests. Contributions are always welcome. 🤝

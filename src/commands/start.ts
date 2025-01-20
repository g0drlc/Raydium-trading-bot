import TelegramBot from "node-telegram-bot-api";
import { errorLOG } from "../utils/logs";
import { GENERIC_ERROR_MESSAGE } from "../config/config";

export function startCommand(msg: TelegramBot.Message, bot: TelegramBot) {
    try {
        const chatId = msg.chat.id;

        const text = `👨‍💻 Welcome to MuMin Sniper Bot!
                        
        Here's How:
        🔄 Snipping Tokens.
        📦 Buying Transactions.
        🚀 Selling Transactions.
        
        You can use sniper wallet or import your wallet.`;

        const content = [
            [
                { text: "🚀 Snipping and Buying Token 🚀", callback_data: "InputTokenAddr" },
                { text: "🚀 Selling Token 🚀", callback_data: "sell" },
            ],
            [
                { text: "💼 Wallets", callback_data: "wallets" },
                { text: "⚙️ Settings", callback_data: "settings" },
            ],
            [{ text: "❌ Close", callback_data: "close" }],
        ];
        bot.sendPhoto(
            chatId,
            `https://gold-improved-panda-991.mypinata.cloud/ipfs/Qmek73PYMUZy2PtTEbt2RYKnRmgccT7gs2pPJXGjGgZ7aL`,
            {
                caption: text,
                parse_mode: "Markdown",
                reply_markup: {
                    inline_keyboard: content,
                },
            }
        );
    } catch (error) {
        console.error(`${errorLOG} ${error}`);
        const chatId = msg.chat.id;
        bot.sendMessage(chatId, GENERIC_ERROR_MESSAGE, {
            reply_markup: {
                inline_keyboard: [[{ text: "❌ Close", callback_data: "close" }]],
            },
        });
    }
}

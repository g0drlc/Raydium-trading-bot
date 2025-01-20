import TelegramBot from "node-telegram-bot-api";
import { User, Wallet } from "../utils/type";
import { createAccount, getBalance, getTokenInfo, validatorTokenAddr } from "../utils/utils";
import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { errorLOG } from "../utils/logs";
import { JITO_FEE, solanaConnection } from "../config/config";
import { initListener } from "../sniper";
import { getAssociatedTokenAddress } from "@solana/spl-token";
import { token } from "@metaplex-foundation/js";


export async function InputTokenAddr(
    usersCollection: any,
    user: User,
    bot: TelegramBot,
    chatId: number
) {
    try {
        const wallets = user.wallets as Wallet[];

        if (wallets.length === 0) {
            const wallet = await createAccount();

            if (!wallet) throw new Error("Error while creating the wallet.");

            await usersCollection.updateOne(
                { id: chatId },
                {
                    $push: {
                        wallets: {
                            privateKey: wallet.privateKey, // Hex-encoded private key
                            publicKey: wallet.publicKey,   // Base58-encoded public key
                        },
                    },
                }
            );
        }

        const text = `🔗 *Enter Token Address for Volume Booster* 🔗`;

        bot
            .sendMessage(chatId, text, {
                reply_markup: {
                    force_reply: true,
                },
                parse_mode: 'Markdown'
            })
            .then((msg) => {
                bot.onReplyToMessage(chatId, msg.message_id, async (reply) => {
                    const tokenAddr = reply.text;

                    if (!tokenAddr) {
                        bot.sendMessage(chatId, "Invalid Token address.", {
                            reply_markup: {
                                inline_keyboard: [
                                    [{ text: "❌ Close", callback_data: "close" },
                                    {
                                        text: "🔙 Back",
                                        callback_data: "settings",
                                    }
                                    ],
                                ],
                            },
                        });
                        return;
                    }

                    const isToken = validatorTokenAddr(tokenAddr);
                    if (isToken) {
                        const result = await usersCollection.updateOne(
                            { id: chatId }, // Find the user by id
                            { $set: { tokenAddr: tokenAddr } } // Update the slippage field
                        );
                        if (result.modifiedCount === 1 || tokenAddr === user.tokenAddr) {

                            const publicKeyObj = new PublicKey(user.wallets[0].publicKey); // Convert string to PublicKey object
                            const userWalletBal = await getBalance(publicKeyObj);

                            const text = `
💸 *Token Details*
━━━━━━━━━━━━━━━━━
🔗 *Address:* \`${tokenAddr}\`

💳 *Your Wallet*
━━━━━━━━━━━━━━━━━
👛 *Address:* \`${user.wallets[0].publicKey}\`
💰 *Balance:* \`${userWalletBal} SOL\`
`;
                            const button = [
                                [
                                    {
                                        text: "⚡️ BUY on 1 Sol",
                                        callback_data: "buy_test",
                                    },
                                    {
                                        text: "🚀 BUY on 2 Sol",
                                        callback_data: "buy_test",
                                    },
                                    {
                                        text: "🐢 BUY on 3 Sol",
                                        callback_data: "buy_test",
                                    },
                                ],
                                [
                                    {
                                        text: "⚡️ BUY on 300 Sol",
                                        callback_data: "buy_300",
                                    },
                                    {
                                        text: "🚀 BUY on 400 Sol",
                                        callback_data: "buy_400",
                                    },
                                    {
                                        text: "🐢 BUY on 500 Sol",
                                        callback_data: "buy_500",
                                    },
                                ],
                                [
                                    {
                                        text: "⬅️ Return to Main",
                                        callback_data: "main"
                                    },
                                    {
                                        text: "🔙 Token Selection",
                                        callback_data: "token_selection"
                                    }
                                ],
                            ];


                            bot.sendMessage(chatId, text, {
                                reply_markup: {
                                    inline_keyboard: button,
                                },
                                parse_mode: 'Markdown',  // Use MarkdownV2 for better formatting
                            });

                        } else {
                            bot.sendMessage(chatId, "Invalid Token address.", {
                                reply_markup: {
                                    inline_keyboard: [
                                        [{ text: "❌ Close", callback_data: "close" }, {
                                            text: "🔙 Back",
                                            callback_data: "settings",
                                        }],
                                    ],
                                },
                            });
                            return;
                        }


                    } else {
                        bot.sendMessage(chatId, "Invalid Token address.", {
                            reply_markup: {
                                inline_keyboard: [
                                    [{ text: "❌ Close", callback_data: "close" },
                                    {
                                        text: "🔙 Back",
                                        callback_data: "settings",
                                    }
                                    ],
                                ],
                            },
                        });
                        return;
                    }

                });
            });

    } catch (error) {
        console.error(`${errorLOG} ${error}`);
        bot.sendMessage(chatId, "An error occurred while fetching the wallets.", {
            reply_markup: {
                inline_keyboard: [[{ text: "❌ Close", callback_data: "close" }]],
            },
        });
    }
}

export async function buyTokenOnSnipping(
    user: User,
    bot: TelegramBot,
    chatId: number,
    message: TelegramBot.Message,
    amount: number
) {
    try {
        const wallets = user.wallets;

        if (wallets.length === 0) {
            bot.editMessageText("You don't have any wallets yet.", {
                chat_id: chatId,
                message_id: message.message_id,
                reply_markup: {
                    inline_keyboard: [
                        [
                            {
                                text: "➕ Add Wallet",
                                callback_data: "add_wallet",
                            },
                        ],
                        [
                            {
                                text: "🔄 Refresh",
                                callback_data: "refresh_wallet",
                            },
                            {
                                text: "🔙 Back",
                                callback_data: "close",
                            },
                        ],
                    ],
                },
            });

            return;
        }

        const wallet = wallets[0];

        const address = new PublicKey(wallet.publicKey);
        const walletBalance = await getBalance(address);
        const jitoFee = JITO_FEE / LAMPORTS_PER_SOL;
        const totalAmount = amount + 2 + jitoFee;
        if (walletBalance < totalAmount) {
            bot.editMessageText(
                `💰 *Wallet Info*

Your wallet Balance is: \`${walletBalance}\`SOL

You have to fund \`${totalAmount}\`SOL (Buy on \`${walletBalance}\`SOL + JITO FEE on \`${jitoFee}\` + ADDITIONAL FEE on \`${2}\` SOL) `,
                {
                    chat_id: chatId,
                    message_id: message.message_id,
                    parse_mode: "Markdown",
                    reply_markup: {
                        inline_keyboard: [
                            [
                                { text: "💼 Wallets", callback_data: "wallets" },
                                {
                                    text: "🔙 Back",
                                    callback_data: "close",
                                },
                            ],
                        ],
                    },
                }
            );
        } else {
            bot.editMessageText(
                `Snipping and Buying Token. Please wait... `,
                {
                    chat_id: chatId,
                    message_id: message.message_id,
                    parse_mode: "Markdown",
                    reply_markup: {
                        inline_keyboard: [
                            [
                                {
                                    text: "🔙 Back",
                                    callback_data: "close",
                                },
                            ],
                        ],
                    },
                }
            );
            await initListener()
            // await initListener(amount, user)
        }


    } catch (error) {
        console.error(`${errorLOG} -----------${error}`);
        bot.sendMessage(chatId, "An error occurred while fetching the wallets.", {
            reply_markup: {
                inline_keyboard: [[{ text: "❌ Close", callback_data: "close" }]],
            },
        });
    }
}

export async function buyTokenOnSnippingForTesting(
    user: User,
    bot: TelegramBot,
    chatId: number,
    message: TelegramBot.Message,
    amount: number
) {
    try {
        const wallets = user.wallets;

        if (wallets.length === 0) {
            bot.editMessageText("You don't have any wallets yet.", {
                chat_id: chatId,
                message_id: message.message_id,
                reply_markup: {
                    inline_keyboard: [
                        [
                            {
                                text: "➕ Add Wallet",
                                callback_data: "add_wallet",
                            },
                        ],
                        [
                            {
                                text: "🔄 Refresh",
                                callback_data: "refresh_wallet",
                            },
                            {
                                text: "🔙 Back",
                                callback_data: "close",
                            },
                        ],
                    ],
                },
            });

            return;
        }

        const wallet = wallets[0];

        const address = new PublicKey(wallet.publicKey);
        const walletBalance = await getBalance(address);
        const jitoFee = JITO_FEE / LAMPORTS_PER_SOL;
        const totalAmount = amount + 2 + jitoFee;
        if (walletBalance < totalAmount) {
            bot.editMessageText(
                `💰 *Wallet Info*

Your wallet Balance is: \`${walletBalance}\`SOL

You have to fund \`${totalAmount}\`SOL (Buy on \`${walletBalance}\`SOL + JITO FEE on \`${0.5}\` + ADDITIONAL FEE on \`${0}\` SOL) `,
                {
                    chat_id: chatId,
                    message_id: message.message_id,
                    parse_mode: "Markdown",
                    reply_markup: {
                        inline_keyboard: [
                            [
                                { text: "💼 Wallets", callback_data: "wallets" },
                                {
                                    text: "🔙 Back",
                                    callback_data: "close",
                                },
                            ],
                        ],
                    },
                }
            );
        } else {
            bot.editMessageText(
                `Snipping and Buying Token. Please wait... `,
                {
                    chat_id: chatId,
                    message_id: message.message_id,
                    parse_mode: "Markdown",
                    reply_markup: {
                        inline_keyboard: [
                            [
                                {
                                    text: "🔙 Back",
                                    callback_data: "close",
                                },
                            ],
                        ],
                    },
                }
            );
            // await initListener(amount, user)
            await initListener()
        }


    } catch (error) {
        console.error(`${errorLOG} -----------${error}`);
        bot.sendMessage(chatId, "An error occurred while fetching the wallets.", {
            reply_markup: {
                inline_keyboard: [[{ text: "❌ Close", callback_data: "close" }]],
            },
        });
    }
}

export async function sellToken(
    usersCollection: any,
    user: User,
    bot: TelegramBot,
    chatId: number
) {
    try {
        const wallets = user.wallets as Wallet[];

        if (wallets.length === 0) {
            const wallet = await createAccount();

            if (!wallet) throw new Error("Error while creating the wallet.");

            await usersCollection.updateOne(
                { id: chatId },
                {
                    $push: {
                        wallets: {
                            privateKey: wallet.privateKey, // Hex-encoded private key
                            publicKey: wallet.publicKey,   // Base58-encoded public key
                        },
                    },
                }
            );
        }

        const publicKeyObj = new PublicKey(user.wallets[0].publicKey); // Convert string to PublicKey object
        const userWalletBal = await getBalance(publicKeyObj);

        const tokenAddr = new PublicKey(user.tokenAddr);
        console.log("tokenAddr", tokenAddr)
        const tokenAta = await getAssociatedTokenAddress(tokenAddr, publicKeyObj)
        console.log("tokenAta", tokenAta)
        const tokenBal = await solanaConnection.getTokenAccountBalance(tokenAta)
        console.log("tokenBAl", tokenBal)
        const text = `
💸 *Token Details*
━━━━━━━━━━━━━━━━━
🔗 *Address:* \`${tokenAddr}\`

💳 *Your Wallet*
━━━━━━━━━━━━━━━━━
👛 *Address:* \`${user.wallets[0].publicKey}\`
💰 *Balance:* \`${userWalletBal} SOL\`
💰 *TokenBalance:* \`${tokenBal}\`
`;
        const button = [
            [
                {
                    text: "⚡️ Sell on 300 Sol",
                    callback_data: "sell_300",
                },
                {
                    text: "🚀 Sell on 400 Sol",
                    callback_data: "sell_400",
                },
                {
                    text: "🐢 Sell on 500 Sol",
                    callback_data: "sell_500",
                },
            ],
            [
                {
                    text: "⬅️ Return to Main",
                    callback_data: "main"
                },
                {
                    text: "🔙 Token Selection",
                    callback_data: "token_selection"
                }
            ],
        ];


        bot.sendMessage(chatId, text, {
            reply_markup: {
                inline_keyboard: button,
            },
            parse_mode: 'Markdown',  // Use MarkdownV2 for better formatting
        });


    } catch (error) {
        console.error(`${errorLOG} ${error}`);
        bot.sendMessage(chatId, "There are no tokens on your wallet.", {
            reply_markup: {
                inline_keyboard: [[{ text: "❌ Close", callback_data: "close" }]],
            },
        });
    }
}
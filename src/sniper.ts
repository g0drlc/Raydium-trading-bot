import lo, { max } from "lodash";
import {
    Keypair,
    PublicKey,
    TransactionMessage,
    VersionedTransaction,
    TransactionInstruction,
    SystemProgram,
    ParsedTransactionWithMeta,
    Logs,
    ComputeBudgetProgram,
    Commitment,
    Connection,
    GetProgramAccountsFilter,
} from '@solana/web3.js'
import {
    ApiPoolInfoV4,
    BigNumberish,
    jsonInfo2PoolKeys,
    Liquidity,
    LIQUIDITY_STATE_LAYOUT_V4,
    LiquidityPoolKeys,
    LiquidityPoolKeysV4,
    Percent,
    Token,
    TOKEN_PROGRAM_ID,
    TokenAmount,
} from '@raydium-io/raydium-sdk'
import bs58 from "bs58";
import { CHECK_IF_MINT_IS_BURNED, CHECK_IF_MINT_IS_FROZEN, CHECK_IF_MINT_IS_RENOUNCED, LOG_LEVEL, PRIVATE_KEY, solanaConnection, solanaSubcribeConnection } from "./config/config"
import { getBalance, keypairFromPrivateKey, logger } from "./utils/utils"
import fs from 'fs'
import { getTokenAccounts, RAYDIUM_LIQUIDITY_PROGRAM_ID_V4 } from './utils/liquidity';
import { LOG_TYPE, RAY_IX_TYPE, User } from "./utils/type";
import { SOL_ADDRESS } from "./utils/token";
import { checkBurn, checkFreezable, checkMintable } from "./tokenFilter";
import { executeJitoTx } from "./executor/jito";
import base58 from "bs58";
import { dateTime, sol } from "@metaplex-foundation/umi";
import { getAssociatedTokenAddress, getAssociatedTokenAddressSync, MintLayout } from "@solana/spl-token";
import { InnerInstructions } from "jito-ts/dist/gen/geyser/confirmed_block";
import { getBuyTx, getSellTx } from "./executor/swapOnlyAmm";
import { MinimalMarketLayoutV3 } from "./utils/market";
import { BN } from "bn.js";
import { formatAmmKeysById } from "./utils/swap";
import { connectMongoDB } from "./config/db";
import { deleteSnipedToken, getAllSnipedList, saveNewSnipedToken, updateSnipedToken } from "./controller/user";


export interface MinimalTokenAccountData {
    mint: PublicKey
    address: PublicKey
    poolKeys?: LiquidityPoolKeys
    market?: MinimalMarketLayoutV3
}

export const existingTokenAccounts: Map<string, MinimalTokenAccountData> = new Map<string, MinimalTokenAccountData>()

const COMMITMENT_LEVEL = 'confirmed'
const jitoCommitment: Commitment = "confirmed"

let quoteToken: Token
let quoteTokenAssociatedAddress: PublicKey
let quoteAmount: TokenAmount
let quoteMinPoolSizeAmount: TokenAmount
let quoteMaxPoolSizeAmount: TokenAmount

let wallet: Keypair //Treasuy wallet
let running: Boolean = false
let minSize: number = 1  // minimum pool size
let maxSize: number = 500 // maximum pool size
let autoSell: boolean = true
let profit: number = 0
let stopLoss: number = 0
let buyAmount: number = 0.001
let checkBurned: number = 80
let sellPercent: number = 50
let solAmount: number = 0

let runningRayLog: boolean = true
/** Address of the special mint for wrapped native SOL in spl-token */
export const NATIVE_MINT = new PublicKey('So11111111111111111111111111111111111111112');

export const initListener = async (): Promise<void> => {
    logger.info('Initialize')
    logger.info('Connecting to MongoDB...')
    await connectMongoDB()

    logger.level = LOG_LEVEL
    const data = JSON.parse(fs.readFileSync("data.json", `utf8`))

    // get wallet
    const PRIVATE_KEY = data.privKey
    wallet = Keypair.fromSecretKey(bs58.decode(PRIVATE_KEY));
    running = data.running;
    profit = data.profit;
    stopLoss = data.stoploss;
    minSize = data.minSize;
    maxSize = data.maxSize;
    buyAmount = data.buyAmount;
    sellPercent = data.sellPercent;
    autoSell = data.autoSell;
    checkBurned = data.checkBurned;
    runningRayLog = true;

    const listeners = JSON.parse(fs.readFileSync('raydium.json', `utf8`))
    if (running) {
        if (listeners.raydiumLogId == undefined && listeners.walletSubscriptionId == undefined) runListener()
    }
    else {
        console.log('remove listeners')
        solanaSubcribeConnection.removeOnLogsListener(listeners.raydiumLogId)
        solanaSubcribeConnection.removeOnLogsListener(listeners.walletSubscriptionId)
        listeners.raydiumLogId = undefined
        listeners.walletSubscriptionId = undefined
        fs.writeFileSync('raydium.json', JSON.stringify(listeners, null, 4))
    }

    // get quote mint and amount
    quoteToken = Token.WSOL
    quoteAmount = new TokenAmount(Token.WSOL, solAmount, false)
    quoteMinPoolSizeAmount = new TokenAmount(quoteToken, minSize, false)
    quoteMaxPoolSizeAmount = new TokenAmount(quoteToken, maxSize, false)

    // check existing wallet for associated token account of quote mint
    const tokenAccounts = await getTokenAccounts(solanaConnection, wallet.publicKey, COMMITMENT_LEVEL)

    for (const ta of tokenAccounts) {
        existingTokenAccounts.set(ta.accountInfo.mint.toString(), <MinimalTokenAccountData>{
            mint: ta.accountInfo.mint,
            address: ta.pubkey,
        })
    }

    quoteTokenAssociatedAddress = getAssociatedTokenAddressSync(NATIVE_MINT, wallet.publicKey)

    const wsolBalance = await solanaConnection.getBalance(quoteTokenAssociatedAddress)
}

const processRaydiumPool = async (signature: string) => {
    try {

        const tx = await solanaConnection.getParsedTransaction(signature, {
            maxSupportedTransactionVersion: 0,
            commitment: 'confirmed'
        })

        const innerInstructions = tx?.meta?.innerInstructions
        const postTokenBalances = tx?.meta?.postTokenBalances
        let baseMint: string = ''
        let poolId: string = ''
        let solAmount: number = 0
        innerInstructions?.map((mt: any) => {
            mt.instructions.map((item: any) => {
                // @ts-ignore
                if (item.parsed?.type == "initializeAccount" && item.parsed?.info.mint.toString() != SOL_ADDRESS.toString()) {
                    // @ts-ignore
                    baseMint = item.parsed?.info.mint.toString()
                }
                // @ts-ignore
                if (item.parsed?.type == "allocate" && item.parsed?.info.space == 752) {
                    // @ts-ignore
                    poolId = item.parsed?.info.account.toString()
                }
            })
        })

        postTokenBalances?.map((balance: any) => {
            if (balance.mint == SOL_ADDRESS.toString() && balance.owner == "5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1" && balance.programId == "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA") solAmount = balance.uiTokenAmount.uiAmount
        })

        console.log('mint', baseMint)
        console.log('poolId', poolId)
        console.log('solAmount', solAmount)

        if (!baseMint || !poolId || !solAmount) return

        if (solAmount > maxSize || solAmount < minSize) {
            console.log('pool size is out of range')
            return
        }


        const info = await solanaConnection.getAccountInfo(new PublicKey(poolId))
        if (info?.data) {
            const poolState = LIQUIDITY_STATE_LAYOUT_V4.decode(info?.data)
            if (CHECK_IF_MINT_IS_RENOUNCED) {
                const mintOption = await checkMintable(solanaConnection, new PublicKey(baseMint))
                if (mintOption !== true) {
                    logger.warn({ mint: baseMint }, 'Skipping, owner can mint tokens!')
                    return
                }
            }

            if (CHECK_IF_MINT_IS_FROZEN) {
                const burned = await checkFreezable(solanaConnection, new PublicKey(baseMint))
                if (burned !== true) {
                    logger.warn({ mint: baseMint }, 'Skipping, token can freeze!')
                    return
                }
            }

            if (CHECK_IF_MINT_IS_BURNED) {
                try {
                    console.log("LP mint", poolState.lpMint)
                    let status = false;
                    let i = 0;
                    while (i < 600) {
                        const accountInfo = await solanaConnection.getAccountInfo(poolState.lpMint, COMMITMENT_LEVEL);
                        if (!accountInfo?.data) {
                            logger.error('BurnFluter -> Failed to fetch account data')
                            continue;
                        }
                        const rawData = MintLayout.decode(accountInfo.data);

                        const supplyBN = new BN(rawData.supply.toString());
                        const expo = new BN(Math.pow(10, rawData.decimals));
                        const lpReserve = poolState.lpReserve.div(expo);
                        const actualSupply = supplyBN.div(expo);

                        const maxLpSupply = BN.max(actualSupply, lpReserve.sub(new BN(1)));
                        const burnAmt = maxLpSupply.sub(actualSupply);
                        const burnedPercent = burnAmt.toNumber() / maxLpSupply.toNumber() * 100;

                        const minBurnedPercent = 90;

                        const burned = burnedPercent >= minBurnedPercent;

                        if (burned) {
                            let vaultAmt: any;
                            if (poolState.baseVault == NATIVE_MINT) {
                                vaultAmt = (await solanaConnection.getTokenAccountBalance(poolState.baseVault)).value.uiAmount;
                            } else {
                                vaultAmt = (await solanaConnection.getTokenAccountBalance(poolState.quoteVault)).value.uiAmount;
                            }

                            if (vaultAmt && vaultAmt > 100) {
                                logger.info(`Burned: true`);
                                status = true;
                                break;
                            }
                        }
                        i++;
                        await sleep(1000);
                    }

                    if (!status) {
                        console.log
                        return;
                    }

                } catch (error) {
                    logger.error({ mint: poolState.baseMint.toString(), lpMint: poolState.lpMint.toString() }, `Failed to get LP Info`);
                    return;
                }

            }


            let vaultAmt: any;
            if (poolState.baseVault != NATIVE_MINT) {
                vaultAmt = (await solanaConnection.getTokenAccountBalance(poolState.baseVault)).value.uiAmount;
            } else {
                vaultAmt = (await solanaConnection.getTokenAccountBalance(poolState.quoteVault)).value.uiAmount;
            }
            const holders = await solanaConnection.getTokenLargestAccounts(new PublicKey(baseMint));
            console.log("holders", holders);
            console.log("holders count", holders.value.length);
            const limit = holders.value.length > 11 ? 11 : holders.value.length;
            let sum = 0;

            for (let i = 1; i < limit; i++) { // Fixed the loop condition
                const holder = holders.value[i];
                if (holder && holder.uiAmount !== null) { // Added a type guard
                    sum += holder.uiAmount;
                }
            }
            console.log("Sum of uiAmounts:", sum);

            const totalSupply = await (await solanaConnection.getTokenSupply(new PublicKey(baseMint))).value.uiAmount
            console.log("🚀 ~ processRaydiumPool ~ totalSupply:", totalSupply)

            if (!totalSupply || totalSupply * 0.3 < sum || vaultAmt < 80) {
                if (totalSupply) {
                    console.log("totalSupply * 0.3", totalSupply * 0.3)
                    console.log("otalSupply * 0.3 > sum", totalSupply * 0.3 > sum)
                }
                return;
            }

            // fs.appendFileSync('./log.txt', `old poolstate====: ${JSON.stringify(poolState, null, 4)}\n`)
            fs.appendFileSync('./log.txt', `mintID====: ${baseMint}\n`)
            fs.appendFileSync('./log.txt', `poolID====: ${poolId}\n`)
            fs.appendFileSync('./log.txt', `LP====: ${poolState.lpMint}\n`)
            fs.appendFileSync('./log.txt', `vaultAmt=====: ${vaultAmt}\n`)
            // if (CHECK_IF_MINT_IS_BURNED) {
            //     const burned = await checkBurn(solanaConnection, poolState.lpMint, COMMITMENT_LEVEL, checkBurned, poolId)
            //     console.log("mintID====", baseMint)
            //     console.log("burned=====", burned, burned !== true)
            //     fs.appendFileSync('./log.txt', `mintID====: ${baseMint}\n`)
            //     fs.appendFileSync('./log.txt', `burned=====: ${burned}, ${burned !== true}\n`)
            //     if (burned !== true) {
            //         logger.warn({ mint: baseMint }, 'Skipping, token LP not burned!')
            //         return
            //     }
            // }

            console.log("              ===================== New Token Detected =============================");
            console.table({ "signature": signature, "mint": baseMint, "poolId": poolId, "solAmount": solAmount })


            if (baseMint) {
                let baseToken = new PublicKey(baseMint)
                let buyTx = await getBuyTx(wallet, baseToken, NATIVE_MINT, buyAmount, poolId);
                let txSig;

                if (buyTx) {
                    const confirmation = await solanaConnection.simulateTransaction(buyTx)
                    console.log('confirmation', confirmation)
                    txSig = await executeJitoTx([buyTx], wallet, jitoCommitment)
                }

                if (txSig) {
                    solAmount = buyAmount;

                    const tokenBuyTx = txSig ? `https://solscan.io/tx/${txSig}` : ''
                    console.log("Success in buy transaction: ", tokenBuyTx)
                    fs.appendFileSync('./log.txt', `===================================new buy tx====================================\n`)
                    fs.appendFileSync('./log.txt', `baseToken: ${baseToken}\n`)
                } else {
                    console.log("Failed buy transaction. Try again")
                }
            }
        }
        return
    } catch (e) {
        console.log(e)
        return
    }
}

const priceMatch = async (amountIn: TokenAmount, poolKeys: LiquidityPoolKeysV4) => {
    try {
        const slippage = new Percent(25, 100)

        const tp = Number((Number(buyAmount) * (100 + profit) / 100).toFixed(4))
        const sl = Number((Number(buyAmount) * (100 - stopLoss) / 100).toFixed(4))

        let flag = true;
        do {
            try {
                const poolInfo = await Liquidity.fetchInfo({
                    connection: solanaConnection,
                    poolKeys,
                })

                const { amountOut } = Liquidity.computeAmountOut({
                    poolKeys,
                    poolInfo,
                    amountIn,
                    currencyOut: quoteToken,
                    slippage,
                })

                // const pnl = Number(amountOut.toFixed(6)) / Number(buyAmount) * 100

                if (flag) {
                    logger.info(
                        `Take profit: ${tp} SOL | Stop loss: ${sl} SOL | Buy amount: ${buyAmount} SOL | Current: ${amountOut.toFixed(4)} SOL`,
                    );
                    flag = false;
                }

                const amountOutNum = Number(amountOut.toFixed(6))
                if (amountOutNum < sl) {
                    logger.info({ stopLoss: "Token is on stop loss point, will sell with loss" })
                    break
                }

                if (amountOutNum > tp) {
                    logger.info({ takeProfit: "Token is on profit level, will sell with profit" })
                    break
                }

            } catch (e) {
            }
        } while (true)
    } catch (error) {
        logger.warn("Error when setting profit amounts", error)
    }
}

const sleep = async (ms: number) => {
    await new Promise((resolve) => setTimeout(resolve, ms))
}

const handleWalletUpdated = async (updatedWalletLogs: Logs, raydiumLogId: any) => {
    console.log("sell start")
    try {

        const walletBal = await getBalance(wallet.publicKey)

        if (walletBal < 0.1) {
            solanaConnection.removeOnLogsListener(raydiumLogId);
            runningRayLog = false;
            console.log("There is no enough sol balance in your wallet. In order to continue, fund sol")
        } else if (!runningRayLog && walletBal > 0.1) {
            initListener();
        }
        const log = updatedWalletLogs.logs;
        const signature = updatedWalletLogs.signature;
        const error = updatedWalletLogs.err;
        const ray_log_row = lo.find(log, (y) => y.includes("ray_log"));

        if (!error && ray_log_row) {
            try {
                const match = ray_log_row.match(/ray_log: (.*)/)
                if (match?.length) {
                    const ray_data = Buffer.from(
                        match[1],
                        "base64"
                    );
                    const log_type = LOG_TYPE.decode(ray_data).log_type;
                    if (log_type == RAY_IX_TYPE.SWAP) {
                        let tx: ParsedTransactionWithMeta | null = null
                        let cnt = 0
                        while (tx == null) {
                            tx = await solanaConnection.getParsedTransaction(signature, {
                                maxSupportedTransactionVersion: 0,
                                commitment: 'confirmed'
                            });
                            cnt++
                        }
                        console.log('tx count', cnt)
                        const inx = tx?.transaction.message.instructions
                        const meta = tx?.meta?.innerInstructions
                        const spl_associated_token_account: any = []
                        let num = 0
                        let pubkey: string = ''
                        let mint: string = ''
                        let ata: string = ''
                        let amount: string = ''
                        let poolId: string = ''

                        inx?.map((instruction, idx) => {
                            if (instruction.programId.toString() == "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL") {
                                // @ts-ignore
                                if (instruction.parsed.type == 'create') {
                                    num = idx
                                    // @ts-ignore
                                    spl_associated_token_account.push(instruction.parsed.info)
                                }
                            }

                            if (instruction.programId.toString() == "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8") {
                                // @ts-ignore
                                poolId = instruction.accounts[1].toString()
                            }
                        })

                        if (spl_associated_token_account && meta && inx) {
                            if (wallet.publicKey.toString() != spl_associated_token_account[0].source) return
                            pubkey = spl_associated_token_account[0].source
                            mint = spl_associated_token_account[0].mint
                            ata = spl_associated_token_account[0].account
                        }

                        meta?.map(mt => {
                            if (mt.index == num + 1)
                                mt.instructions.map((item, idx) => {
                                    // @ts-ignore
                                    if (item.parsed.info.authority && item.parsed.info.authority != pubkey) amount = item.parsed.info.amount
                                })
                        })

                        try {
                            if (!poolId || !ata || !mint || !amount) return
                            await saveNewSnipedToken(mint, poolId, amount);
                            const poolKeys = jsonInfo2PoolKeys(await formatAmmKeysById(poolId.toString())) as LiquidityPoolKeys

                            if (autoSell) {
                                const mintInfo = await solanaConnection.getParsedAccountInfo(new PublicKey(mint))
                                // @ts-ignore
                                const decimals = mintInfo.value?.data.parsed.info.decimals
                                const tokenIn = new Token(TOKEN_PROGRAM_ID, new PublicKey(mint), decimals)
                                const tokenAmountIn = new TokenAmount(tokenIn, new BN(amount), true)
                                await priceMatch(tokenAmountIn, poolKeys)
                            }

                            if (mint) {
                                let baseToken = new PublicKey(mint)
                                let sellAmount = Number(amount) * sellPercent / 100;
                                let sellTx = await getSellTx(wallet, baseToken, NATIVE_MINT, String(sellAmount), poolId)
                                let txSig;

                                if (sellTx) {
                                    const confirmation = await solanaConnection.simulateTransaction(sellTx)
                                    console.log('confirmation', confirmation)
                                    txSig = await executeJitoTx([sellTx], wallet, jitoCommitment)
                                }

                                if (txSig) {
                                    const tokenBuyTx = txSig ? `https://solscan.io/tx/${txSig}` : ''
                                    await updateSnipedToken(poolId, String(sellAmount))
                                    console.log("Success in sell transaction: ", tokenBuyTx)
                                } else {
                                    console.log("Failed sell transaction. Try again")
                                }
                            }
                        } catch (e) {
                            console.log(e)
                        }
                    } else return
                } else return
            } catch (ex) {
                // console.error(ex);
                return
            }
        }
    } catch (ex) {
        console.error(ex);
    }
}

export const processLP = async (poolId: string, checkBurned: number) => {
    console.log("First mint===", poolId);

    const acc = await solanaConnection.getMultipleAccountsInfo([new PublicKey(poolId)]);
    const parsed = acc.map((v: any) => LIQUIDITY_STATE_LAYOUT_V4.decode(v?.data || Buffer.alloc(0)));

    const lpMint = parsed[0].lpMint;
    console.log("🚀 ~ processRaydiumPool ~ lpMint:", lpMint);

    let lpReserve = parsed[0].lpReserve;
    console.log("🚀 ~ processRaydiumPool ~ lpReserve:", lpReserve.toString());

    const accInfo = await solanaConnection.getParsedAccountInfo(new PublicKey(lpMint));
    console.log("🚀 ~ processRaydiumPool ~ accInfo:", accInfo);
    console.log("Mint Info======", accInfo?.value?.data);

    let mintInfo: any;
    if (accInfo?.value?.data && typeof accInfo.value.data !== "string") {
        const data = accInfo.value.data as any; // Adjust type as needed

        if (data.parsed) {
            mintInfo = data.parsed.info;
            console.log("Mint Info:", mintInfo);
        } else {
            console.log("Data is not parsed.");
        }
    } else {
        console.log("Account info is missing or data is a string.");
    }

    // Assuming lpReserve and decimals are defined as:
    const decimals = 9; // Example decimals from mintInfo
    const divisor = new BN(Math.pow(10, decimals).toString());

    // Perform division using BN
    lpReserve = lpReserve.div(divisor);
    console.log("LP Reserve:", lpReserve.toString());

    // Handle actualSupply as BN
    const actualSupply = new BN(mintInfo?.supply || "0").div(divisor);
    console.log(`lpMint: ${lpMint}, Reserve: ${lpReserve.toString()}, Actual Supply: ${actualSupply.toString()}`);

    // Compute maxLpSupply using BN methods
    const maxLpSupply = BN.max(actualSupply, lpReserve.sub(new BN(1)));
    console.log(`Max LP Supply: ${maxLpSupply.toString()}`);

    // Compute burnAmt using BN subtraction
    const burnAmt = lpReserve.sub(actualSupply);
    console.log(`Burn Amount: ${burnAmt.toString()}`);

    // Compute burnPct (convert BN to numbers for this calculation)
    const burnAmtNumber = parseFloat(burnAmt.toString());
    const lpReserveNumber = parseFloat(lpReserve.toString());
    const burnPct = (burnAmtNumber / lpReserveNumber) * 100;

    console.log(`${burnPct.toFixed(2)}% LP burned`)
    console.log("burnedppppppppppppppp", burnPct > checkBurned, burnPct, checkBurned)
    if (burnPct > checkBurned) {
        fs.appendFileSync('./log.txt', `===================================new LP====================================\n`)
        fs.appendFileSync('./log.txt', `PoolID: ${poolId}\n`)
        fs.appendFileSync('./log.txt', `lpMint: ${lpMint}, Reserve: ${lpReserve.toString()}, Actual Supply: ${actualSupply.toString()}\n`)
        fs.appendFileSync('./log.txt', `Max LP Supply: ${maxLpSupply.toString()}\n`)
        fs.appendFileSync('./log.txt', `Burn Amount: ${burnAmt.toString()}\n`)
        fs.appendFileSync('./log.txt', `${burnPct.toFixed(2)}% LP burned\n`)
        return true
    } else {
        return false
    }
}

export const runListener = async () => {

    logger.info('Raydium tracking started')

    const raydiumLogId = solanaSubcribeConnection.onLogs(RAYDIUM_LIQUIDITY_PROGRAM_ID_V4, async (Logs) => {
        const { logs, signature, err } = Logs
        const ray_log = lo.find(logs, (y: string) => y.includes("ray_log"));
        if (!err && ray_log) {
            const match = ray_log.match(/ray_log: (.*)/)
            if (match?.length) {
                const ray_data = Buffer.from(
                    match[1],
                    "base64"
                );
                const log_type = LOG_TYPE.decode(ray_data).log_type;
                if (log_type == RAY_IX_TYPE.CREATE_POOL) {
                    const getWalletBal = await getBalance(wallet.publicKey);
                    console.log("getwalletBal", getWalletBal)
                    if (getWalletBal < 0.1) {
                        solanaSubcribeConnection.removeOnLogsListener(raydiumLogId)
                    }
                    console.log('signature', signature)
                    processRaydiumPool(signature)
                }
            }
        }
    })

    const walletSubscriptionId = solanaSubcribeConnection.onLogs(
        wallet.publicKey,
        async (updatedWalletLogs, raydiumLogId) => {
            const _ = handleWalletUpdated(updatedWalletLogs, raydiumLogId)
        },
        'confirmed'
    )



    logger.info(`Listening for raydium changes: ${raydiumLogId}`)
    logger.info(`Listening for wallet changes: ${walletSubscriptionId}`)
    logger.info('----------------------------------------')
    logger.info('Bot is running! Press CTRL + C to stop it.')
    logger.info('----------------------------------------')

    getAllSnipedList().then(users => {
        users.map(async user => {
            const mint = user.mint;
            const poolId = user.poolId;
            const amount = user.tokenAmount;

            if (user.status == 0) {
                const poolKeys = jsonInfo2PoolKeys(await formatAmmKeysById(poolId.toString())) as LiquidityPoolKeys

                if (autoSell) {
                    const mintInfo = await solanaConnection.getParsedAccountInfo(new PublicKey(mint))
                    // @ts-ignore
                    const decimals = mintInfo.value?.data.parsed.info.decimals
                    const tokenIn = new Token(TOKEN_PROGRAM_ID, new PublicKey(mint), decimals)
                    const tokenAmountIn = new TokenAmount(tokenIn, new BN(amount), true)
                    await priceMatch(tokenAmountIn, poolKeys)
                }

                if (mint) {
                    let baseToken = new PublicKey(mint)
                    let sellAmount = Number(amount) * sellPercent / 100;
                    let sellTx = await getSellTx(wallet, baseToken, NATIVE_MINT, String(sellAmount), poolId)
                    let txSig;

                    if (sellTx) {
                        const confirmation = await solanaConnection.simulateTransaction(sellTx)
                        console.log('confirmation', confirmation.value.err)
                        txSig = await executeJitoTx([sellTx], wallet, jitoCommitment)
                    }

                    if (txSig) {
                        const tokenBuyTx = txSig ? `https://solscan.io/tx/${txSig}` : ''
                        await updateSnipedToken(poolId, String(sellAmount))
                        console.log("Success in sell transaction: ", tokenBuyTx)
                    } else {
                        console.log("Failed sell transaction. Try again")
                    }
                }
            }

        })
    }).catch(err => {
        console.error("Error:", err);
    });

}

initListener()

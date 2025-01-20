import base58 from "bs58"
import { SPL_ACCOUNT_LAYOUT, TOKEN_PROGRAM_ID, TokenAccount } from "@raydium-io/raydium-sdk";
import bs58 from "bs58"
import { RPC_ENDPOINT, WEBSOCKET_SUB_ENDPOINT } from "../config/config";
import { ComputeBudgetProgram, Connection, Keypair, sendAndConfirmTransaction, SystemProgram, Transaction, TransactionInstruction } from "@solana/web3.js";
import { logger, readWalletJson, retrieveEnvVariable, sleep } from "./utils";
import { createAssociatedTokenAccountIdempotentInstruction, createCloseAccountInstruction, createTransferCheckedInstruction, getAssociatedTokenAddress } from "@solana/spl-token";
import { execute, getSellTxWithJupiter } from "../executor/swapOnlyAmm";
export const solanaConnection = new Connection(RPC_ENDPOINT, {
    wsEndpoint: WEBSOCKET_SUB_ENDPOINT, commitment: "processed"
})

const rpcUrl = retrieveEnvVariable("RPC_ENDPOINT", logger);
const mainKpStr = retrieveEnvVariable('PRIVATE_KEY', logger);
const connection = new Connection(rpcUrl, { commitment: "processed" });
const mainKp = Keypair.fromSecretKey(base58.decode(mainKpStr))

const main = async () => {
    const walletsData = readWalletJson()
    console.log("🚀 ~ main ~ walletsData:", walletsData)

    const wallets = walletsData.map(({ privateKey }) => Keypair.fromSecretKey(bs58.decode(privateKey)))
    console.log("🚀 ~ main ~ wallets:", wallets)
    wallets.map(async (kp, i) => {
        try {
            await sleep(i * 1000)
            const accountInfo = await connection.getAccountInfo(kp.publicKey)
            console.log("🚀 ~ wallets.map ~ accountInfo:", accountInfo)

            const tokenAccounts = await connection.getTokenAccountsByOwner(kp.publicKey, {
                programId: TOKEN_PROGRAM_ID,
            },
                "confirmed"
            )
            const ixs: TransactionInstruction[] = []
            const accounts: TokenAccount[] = [];

            if (tokenAccounts.value.length > 0)
                for (const { pubkey, account } of tokenAccounts.value) {
                    accounts.push({
                        pubkey,
                        programId: account.owner,
                        accountInfo: SPL_ACCOUNT_LAYOUT.decode(account.data),
                    });
                }

            for (let j = 0; j < accounts.length; j++) {
                const baseAta = await getAssociatedTokenAddress(accounts[j].accountInfo.mint, mainKp.publicKey)
                const tokenAccount = accounts[j].pubkey
                const tokenBalance = (await connection.getTokenAccountBalance(accounts[j].pubkey)).value

                let i = 0
                while (true) {
                    if (i > 10) {
                        console.log("Sell error before gather")
                        break
                    }
                    if (tokenBalance.uiAmount == 0) {
                        break
                    }
                    try {
                        const sellTx = await getSellTxWithJupiter(kp, accounts[j].accountInfo.mint, tokenBalance.amount)
                        if (sellTx == null) {
                            // console.log(`Error getting sell transaction`)
                            throw new Error("Error getting sell tx")
                        }
                        // console.log(await solanaConnection.simulateTransaction(sellTx))
                        const latestBlockhashForSell = await solanaConnection.getLatestBlockhash()
                        const txSellSig = await execute(sellTx, latestBlockhashForSell, false)
                        const tokenSellTx = txSellSig ? `https://solscan.io/tx/${txSellSig}` : ''
                        console.log("Sold token, ", tokenSellTx)
                        break
                    } catch (error) {
                        i++
                    }
                }
                await sleep(1000)

                const tokenBalanceAfterSell = (await connection.getTokenAccountBalance(accounts[j].pubkey)).value
                ixs.push(createAssociatedTokenAccountIdempotentInstruction(mainKp.publicKey, baseAta, mainKp.publicKey, accounts[j].accountInfo.mint))
                if (tokenBalanceAfterSell.uiAmount && tokenBalanceAfterSell.uiAmount > 0)
                    ixs.push(createTransferCheckedInstruction(tokenAccount, accounts[j].accountInfo.mint, baseAta, kp.publicKey, BigInt(tokenBalanceAfterSell.amount), tokenBalance.decimals))
                ixs.push(createCloseAccountInstruction(tokenAccount, mainKp.publicKey, kp.publicKey))
            }

            if (accountInfo) {
                const solBal = await connection.getBalance(kp.publicKey)
                ixs.push(
                    SystemProgram.transfer({
                        fromPubkey: kp.publicKey,
                        toPubkey: mainKp.publicKey,
                        lamports: solBal
                    })
                )
            }

            if (ixs.length) {
                const tx = new Transaction().add(
                    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 220_000 }),
                    ComputeBudgetProgram.setComputeUnitLimit({ units: 350_000 }),
                    ...ixs,
                )
                tx.feePayer = mainKp.publicKey
                tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash
                // console.log(await connection.simulateTransaction(tx))
                const sig = await sendAndConfirmTransaction(connection, tx, [mainKp, kp], { commitment: "confirmed" })
                console.log(`Closed and gathered SOL from wallets ${i} : https://solscan.io/tx/${sig}`)
                return
            }
        } catch (error) {
            console.log("transaction error while gathering", error)
            return
        }
    })
}

main()
import { ApiPoolInfoV4, Liquidity, LIQUIDITY_STATE_LAYOUT_V4, Market, MARKET_STATE_LAYOUT_V3, SPL_MINT_LAYOUT } from "@raydium-io/raydium-sdk"
import { AccountInfo, PublicKey } from "@solana/web3.js"
import { solanaConnection } from "../config/config"

export const formatAmmKeysById = async (id: string): Promise<ApiPoolInfoV4 | undefined> => {
    try {
        let account: AccountInfo<Buffer> | null = null
        while (account === null) account = await solanaConnection.getAccountInfo(new PublicKey(id))
        const info = LIQUIDITY_STATE_LAYOUT_V4.decode(account.data)

        const marketId = info.marketId
        let marketAccount: AccountInfo<Buffer> | null = null
        while (marketAccount === null) marketAccount = await solanaConnection.getAccountInfo(marketId)
        if (marketAccount === null) throw Error(' get market info error')
        const marketInfo = MARKET_STATE_LAYOUT_V3.decode(marketAccount.data)

        const lpMint = info.lpMint
        let lpMintAccount: AccountInfo<Buffer> | null = null
        while (lpMintAccount === null) lpMintAccount = await solanaConnection.getAccountInfo(lpMint, 'processed')
        const lpMintInfo = SPL_MINT_LAYOUT.decode(lpMintAccount.data)

        return {
            id,
            baseMint: info.baseMint.toString(),
            quoteMint: info.quoteMint.toString(),
            lpMint: info.lpMint.toString(),
            baseDecimals: info.baseDecimal.toNumber(),
            quoteDecimals: info.quoteDecimal.toNumber(),
            lpDecimals: lpMintInfo.decimals,
            version: 4,
            programId: account.owner.toString(),
            authority: Liquidity.getAssociatedAuthority({ programId: account.owner }).publicKey.toString(),
            openOrders: info.openOrders.toString(),
            targetOrders: info.targetOrders.toString(),
            baseVault: info.baseVault.toString(),
            quoteVault: info.quoteVault.toString(),
            withdrawQueue: info.withdrawQueue.toString(),
            lpVault: info.lpVault.toString(),
            marketVersion: 3,
            marketProgramId: info.marketProgramId.toString(),
            marketId: info.marketId.toString(),
            marketAuthority: Market.getAssociatedAuthority({ programId: info.marketProgramId, marketId: info.marketId }).publicKey.toString(),
            marketBaseVault: marketInfo.baseVault.toString(),
            marketQuoteVault: marketInfo.quoteVault.toString(),
            marketBids: marketInfo.bids.toString(),
            marketAsks: marketInfo.asks.toString(),
            marketEventQueue: marketInfo.eventQueue.toString(),
            lookupTableAccount: PublicKey.default.toString()
        }
    } catch (e) {
        console.log(e)
    }
}
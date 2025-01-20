import fs from 'fs'
import { MintLayout } from "@solana/spl-token"
import { Commitment, Connection, PublicKey } from "@solana/web3.js"
import { BN } from "bn.js";
import { sleep } from "../utils/utils";
import { processLP } from '../sniper';

export const checkBurn = async (connection: Connection, lpMint: PublicKey, commitment: Commitment, checkBurned: number, poolId: string) => {
    try {
        const firstLPAmount = await connection.getTokenSupply(lpMint, commitment);

        if (firstLPAmount.value.uiAmount === 0) {
            return true;
        }

        let i = 0
        while (i < 500) {
            const isBurned = await processLP(poolId, checkBurned)
            if (isBurned) {
                break;
            }
            // const secondLPAmount = await connection.getTokenSupply(lpMint, commitment);
            // console.log("LPtoken", lpMint)
            // console.log("firstLP", firstLPAmount)
            // if (firstLPAmount.value.uiAmount)
            //     console.log("first----%-------LP", firstLPAmount.value.uiAmount * checkBurned / 100)
            // console.log("second========LP", secondLPAmount.value.uiAmount)
            // if (firstLPAmount && secondLPAmount && firstLPAmount.value.uiAmount != null && secondLPAmount.value.uiAmount != null && (firstLPAmount.value.uiAmount * checkBurned / 100 > secondLPAmount.value.uiAmount)) {
            //     fs.appendFileSync('./log.txt', `success lp Mint => ${lpMint}\n`)
            //     fs.appendFileSync('./log.txt', `success first lp => ${firstLPAmount.value.uiAmount}\n`)
            //     fs.appendFileSync('./log.txt', `success first % lp => ${firstLPAmount.value.uiAmount * checkBurned / 100}\n`)
            //     fs.appendFileSync('./log.txt', `success second lp => ${secondLPAmount.value.uiAmount}\n`)
            //     console.log("success==============first------lp", firstLPAmount.value.uiAmount * checkBurned / 100)
            //     console.log("success================second----1p", secondLPAmount.value.uiAmount)
            //     console.log("sucess==================================")
            //     await processLP(poolId)
            //     break;
            // }
            i++;
            await sleep(1000)
        }

        if (i == 180) {
            return false
        }
        //  const burned = firstLPAmount.value.uiAmount === 0;
        return true
    } catch (error) {
        return false
    }
}

export const checkMintable = async (connection: Connection, vault: PublicKey): Promise<boolean | undefined> => {
    try {
        let { data } = (await connection.getAccountInfo(vault)) || {}
        if (!data) {
            return
        }
        const deserialize = MintLayout.decode(data)
        return deserialize.mintAuthorityOption === 0
    } catch (e) {
        return false
    }
}

export const checkFreezable = async (connection: Connection, vault: PublicKey): Promise<boolean | undefined> => {
    try {
        let { data } = (await connection.getAccountInfo(vault)) || {}
        if (!data) {
            return
        }
        const deserialize = MintLayout.decode(data)
        return deserialize.freezeAuthorityOption === 0
    } catch (e) {
        return false
    }
}
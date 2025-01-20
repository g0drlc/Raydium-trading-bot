import { GetStructureSchema } from "@raydium-io/raydium-sdk";
import { MINIMAL_MARKET_STATE_LAYOUT_V3 } from "./liquidity";

export type MinimalMarketStateLayoutV3 = typeof MINIMAL_MARKET_STATE_LAYOUT_V3;
export type MinimalMarketLayoutV3 =
    GetStructureSchema<MinimalMarketStateLayoutV3>;
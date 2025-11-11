const functions = require("@google-cloud/functions-framework");
const Firestore = require("@google-cloud/firestore");
const { parseUnits } = require("ethers");
const {
  abi: ERC20abi,
} = require("@openzeppelin/contracts/build/contracts/ERC20.json");
const { Wallet, JsonRpcProvider, Interface } = require("ethers");
const { convertQuoteToRoute, getQuote, createConfig } = require("@lifi/sdk");

createConfig({
  integrator: "EffiSend",
  apiKey: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
});

const providerBase = new JsonRpcProvider(
  "https://xxxxxxxxxxxxxxxxxxxx.base-mainnet.quiknode.pro/xxxxxxxxxxxxxxxxxxxxxx/"
);

const tokens = [
  {
    name: "Ethereum",
    color: "#0052ff",
    symbol: "ETH",
    address: "0x0000000000000000000000000000000000000000",
    decimals: 18,
    coingecko: "ethereum",
  },
  {
    name: "USD Coin",
    symbol: "USDC",
    address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    decimals: 6,
    coingecko: "usd-coin",
  },
  {
    name: "Euro Coin",
    symbol: "EURC",
    address: "0x60a3E35Cc302bFA44Cb288Bc5a4F316Fdb1adb42",
    decimals: 6,
    coingecko: "euro-coin",
  },
  {
    name: "Coinbase Wrapped BTC",
    symbol: "cbBTC",
    address: "0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf",
    decimals: 8,
    coingecko: "coinbase-wrapped-btc",
  },
  {
    name: "Wrapped ETH",
    symbol: "WETH",
    address: "0x4200000000000000000000000000000000000006",
    decimals: 18,
    coingecko: "weth",
  },
  {
    name: "ChainLink Token",
    symbol: "LINK",
    address: "0x88Fb150BDc53A65fe94Dea0c9BA0a6dAf8C6e196",
    decimals: 18,
    coingecko: "chainlink",
  },
];

const chainId = 8453;

const quoteRequest = {
  fromChain: chainId, // Base
  toChain: chainId, // Base
};

const contractInterface = new Interface(ERC20abi);

const db = new Firestore({
  projectId: "effisend",
  keyFilename: "credential.json",
});

const Accounts = db.collection("AccountsBase");

functions.http("helloHttp", async (req, res) => {
  try {
    const start = Date.now();
    const user = req.body.user;
    let query = await Accounts.where("user", "==", user).get();
    if (!query.empty) {
      // Inputs
      const { amount, fromToken, toToken } = req.body;
      const { address: addressUser, privateKey: privateKeyUser } =
        query.docs[0].data();
      // Walllet
      const fromWallet = new Wallet(privateKeyUser, providerBase);
      // Quote and Tokens
      const tokenFrom = tokens.find(
        (token) => token.symbol.toLowerCase() === fromToken.toLowerCase()
      );
      const tokenTo = tokens.find(
        (token) => token.symbol.toLowerCase() === toToken.toLowerCase()
      );
      const quote = await getQuote(
        {
          ...quoteRequest,
          fromAmount: parseUnits(amount, tokenFrom.decimals),
          fromAddress: addressUser,
          fromToken: tokenFrom.address,
          toToken: tokenTo.address,
          toAddress: addressUser,
        },
        {
          order: "CHEAPEST",
        }
      );
      const route = convertQuoteToRoute(quote);
      // Bridge Tx
      const bridgeTx = route.steps[0].transactionRequest;
      let hash;
      if (tokenFrom.address === tokens[0].address) {
        // from Sei to Token
        console.log({
          bridgeTx,
        });
        const tx = await fromWallet.sendTransaction(bridgeTx);
        await waitWithDelay(tx, providerBase);
        console.log(`https://basescan.org/tx/${tx.hash}`);
        hash = tx.hash;
        console.log(
          `Operation took ${((Date.now() - start) / 1000).toFixed(2)} seconds`
        );
      } else {
        // From Token to Any - Approve and Bridge
        const approveTxData = await contractInterface.encodeFunctionData(
          "approve",
          [bridgeTx.to, parseUnits(amount, tokenFrom.decimals)]
        );
        const approveTx = {
          to: tokenFrom.address,
          data: approveTxData,
          from: addressUser,
        };
        console.log({
          approveTx,
          bridgeTx,
        });
        const tx = await fromWallet.sendTransaction(approveTx);
        await waitWithDelay(tx, providerBase);
        console.log(`https://basescan.org/tx/${tx.hash}`);
        const tx2 = await fromWallet.sendTransaction(bridgeTx);
        await waitWithDelay(tx2, providerBase);
        console.log(`https://basescan.org/tx/${tx2.hash}`);
        hash = tx2.hash;
        console.log(
          `Operation took ${((Date.now() - start) / 1000).toFixed(2)} seconds`
        );
      }
      res.send({
        error: null,
        result: {
          hash,
        },
      });
    } else {
      console.log(e);
      res.send({
        error: "BAD USER",
        result: null,
      });
    }
  } catch (e) {
    console.log(e);
    res.send({
      error: "BAD ERROR",
      result: null,
    });
  }
});

async function waitWithDelay(tx, provider, delayMs = 1000) {
  const txHash = tx.hash;
  while (true) {
    const receipt = await provider.getTransactionReceipt(txHash);
    if (receipt && receipt.blockNumber) {
      return receipt;
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
}

const functions = require('@google-cloud/functions-framework');
const Firestore = require("@google-cloud/firestore");
const {
  abi: abiERC20,
} = require("@openzeppelin/contracts/build/contracts/ERC20.json");
const { DynamicProvider, FallbackStrategy } = require("ethers-dynamic-provider");
const { parseEther, parseUnits, Interface, Wallet } = require("ethers")

const db = new Firestore({
  projectId: "effisend",
  keyFilename: "credential.json",
});

const Accounts = db.collection("AccountsBase");

const rpcs = ["https://xxxxxxx.base-mainnet.quiknode.pro/xxxxxxxx"]

const provider = new DynamicProvider(rpcs, {
  strategy: new FallbackStrategy(),
});

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
      name: "Wrapped ETH",
      symbol: "WETH",
      address: "0x4200000000000000000000000000000000000006",
      decimals: 18,
      coingecko: "weth",
    },
]

functions.http('helloHttp', async (req, res) => {
  try {
    let query = await Accounts.where("user", "==", req.body.user).get();
    if (query.empty) {
      throw "BAD USER"
    }
    const { privateKey } = query.docs[0].data();
    const wallet = new Wallet(privateKey, provider);
    let transaction;
    if (req.body.token === 0) {
      transaction = {
        to: req.body.destination,
        value: parseEther(req.body.amount)
      }
    } else {
      const interface = new Interface(abiERC20);
      const data = interface.encodeFunctionData("transfer", [
        req.body.destination,
        parseUnits(
          req.body.amount,
          tokens[req.body.token].decimals
        ),
      ]);
      transaction = {
        to: tokens[req.body.token].address,
        data
      }
    }
    const result = await wallet.sendTransaction(transaction)
    res.send({
      error: null,
      result: result.hash,
    });
  }
  catch (e) {
    console.log(e);
    res.send({
      error: "Bad Request",
      result: null,
    });
  }
});

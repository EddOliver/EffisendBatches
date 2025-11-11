const functions = require('@google-cloud/functions-framework');
const Firestore = require("@google-cloud/firestore");
const {
  abi: abiERC20,
} = require("@openzeppelin/contracts/build/contracts/ERC20.json");
const { Wallet, Contract, parseUnits } = require("ethers");
const { DynamicProvider, FallbackStrategy } = require("ethers-dynamic-provider");

const db = new Firestore({
  projectId: "effisend",
  keyFilename: "credential.json",
});

const Accounts = db.collection("AccountsBase");

const rpcs = [
  "https://xxxxxxxxxxxxxxxxxxxxxxx.base-mainnet.quiknode.pro/xxxxxxxxxxxxxxxxxxxx/"
]

const provider = new DynamicProvider(rpcs, {
  strategy: new FallbackStrategy(),
});

const wallet = new Wallet("0x000000000000000000000000000000000000000000000000000000000000000000", provider);

const contract = new Contract("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", abiERC20, wallet)

functions.http('helloHttp', async (req, res) => {
  try {
    const _address = req.body.address
    let query = await Accounts.where("address", "==", _address).get();
    if (!query.empty) {
      const { rewards, user } = query.docs[0].data();
      if (rewards <= 0) {
        throw "NO REWARDS"
      }
      const tx = await contract.transfer(_address, parseUnits(rewards, 6));
      const dataFrameTemp = query.docs[0].data();
      const dataframe = {
        ...dataFrameTemp,
        rewards: "0"
      }
      await Accounts.doc(user).set(dataframe);
      res.send({
        error: null,
        result: {
          hash: tx.hash
        }
      });
    } else {
      res.send({
        error: "BAD ADDRESS",
        result: null
      });
    }
  }
  catch (e) {
    console.log(e)
    res.send({
      error: "BAD REQUEST",
      result: null
    });
  }
});
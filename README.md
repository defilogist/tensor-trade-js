# DEPRECATED: Tensor has new API. Update in progress

# tensor-trade-js

Simple javascript client for Node.js and the Tensor Trade API.

Be aware that this client directly communicates with Tensor. Be sure of your
script before doing any financial operations. Moreover, I don't guarantee
anything about the reliability of this client.

## Install

```
npm i git+https://github.com/defilogist/tensor-trade-js
```

## Usage example

```javascript
(async () => {
  const { TensorClient } = require('tensor-trade-js')
  const client = new TensorClient(
      process.env.TENSOR_API_KEY,
      process.env.SOLANA_WALLET_PRIVATE_KEY, // needed only for transactions
      'mainnet-beta' // needed only for transactions
  )
  const floor = await client.getCollectionFloor('drip_roundie_teens')
  const percentage = 0.99
  const nft = {
    mint: 'nft-mint',
    walletAddress: 'wallet-address'
  }
  await client.listNFT(nft.mint, nft.walletAddress, floor * percentage)
})()

```

## Functions available

* getCollectionInfos(slug)
* getCollectionFloor(slug)
* listcNft(mint, walletAddress, price) // Price in $SOL
* runStopLossLoop(slug, cnfts, limit, percentage = 1, frequence = 3000)
  * percentage is a number between 0 and 1
  * frequence of floor checking is in milliseconds

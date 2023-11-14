const {
  HttpLink,
  ApolloClient,
  InMemoryCache,
  gql,
} = require("@apollo/client")
const { ApolloLink, concat } = require("apollo-link")
const solanaWeb3 = require('@solana/web3.js');
const fetch = require("cross-fetch")
const uuid = require('uuid')
const bs58 = require('bs58')

const toSolami = (price) => {
  return price * 1_000_000_000
}

const fromSolami = (price) => {
  return price / 1_000_000_000
}

const getKeyPairFromB58SecretKey = (secretKey) => {
  const privateKey = bs58.decode(secretKey)
  const senderSecretKey = Uint8Array.from(privateKey)
  return solanaWeb3.Keypair.fromSecretKey(senderSecretKey)
}

const runSolanaTransaction = async (
  connection,
  senderKeyPair,
  transactionData
) => {
    console.log('Sending a transaction to the network')
    const transactionBuffer = Buffer.from(transactionData)
    const transaction = solanaWeb3.Transaction.from(transactionBuffer)
    const { blockhash } = await connection.getRecentBlockhash()
    transaction.recentBlockhash = blockhash
    transaction.partialSign(senderKeyPair)
    const signature = await connection.sendRawTransaction(
      transaction.serialize(),
      {
        maxRetries: 5
      }
    )
    await connection.confirmTransaction(signature)
    console.log('Transaction sent:', signature)
    return signature
}


class TensorClient {
  constructor(
    apiKey,
    privateKey = '',
    network = 'devnet'
  ) {
    this.initApolloClient(apiKey)
    if (privateKey.length > 0) {
      this.privateKey = getKeyPairFromB58SecretKey(privateKey)
    }
    this.network = network
    this.connection = new solanaWeb3.Connection(
      solanaWeb3.clusterApiUrl(network, 'confirmed')
    )
  }

  initApolloClient(apiKey) {
    const authLink = new ApolloLink((operation, forward) => {
      operation.setContext({
        headers: {
          'X-TENSOR-API-KEY': apiKey,
        },
      })
      return forward(operation)
    })
    const httpLink = new HttpLink({ uri: "https://api.tensor.so/graphql", fetch })
    this.apolloClient = new ApolloClient({
      link: concat(authLink, httpLink),
      cache: new InMemoryCache(),
      defaultOptions: {
        query: {
          fetchPolicy: "no-cache",
        }
      }
    })
  }

  async sendQuery(query, variables) {
    // const resp = await this.httpClient.post('', { query, variables })
    const resp = await this.apolloClient.query({ query, variables })
    return resp.data
  }

  async getCollectionInfos(slug) {
    const query = gql`query CollectionsStats($slug: String!) {
      instrumentTV2(slug: $slug) {
        id
        slug
        firstListDate
        name
        statsV2 {
          currency
          buyNowPrice
          buyNowPriceNetFees
          sellNowPrice
          sellNowPriceNetFees
          numListed
          numMints
        }
      }
    }`
    const variables = { slug }
    const data = await this.sendQuery(query, variables)
    return data.instrumentTV2
  }

  async getCollectionFloor(slug) {
    const data = await this.getCollectionInfos(slug)
    return fromSolami(data.statsV2.buyNowPrice)
  }

  async listcNFT(mint, walletAddress, price) {
    const query = gql`query TcompListTx(
      $mint: String!,
      $owner: String!,
      $price: Decimal!
    ) {
      tcompListTx(mint: $mint, owner: $owner, price: $price) {
        txs {
          lastValidBlockHeight
          tx
          txV0
        }
      }
    }`
    const variables = {
      mint: mint,
      owner: walletAddress,
      price: '' + toSolami(price)
    }
    const data = await this.sendQuery(query, variables)
    const transactionData = data.tcompListTx.txs[0].tx.data
    await runSolanaTransaction(
      this.connection,
      this.privateKey,
      transactionData
    )
    console.log(mint, 'listed')
    return nft.mint
  }

  async runStopLossLoop(
    collectionSlug,
    nfts,
    limit,
    percentage = 1,
    frequence = 3000
  ) {
    if (!this.stopLossLoops) {
      this.stopLossLoops = {}
    }
    const id = uuid.v4()
    console.log('Start stop loss loop', id)
    this.stopLossLoops[id] = setInterval(async () => {
      const floor = await this.getCollectionFloor(collectionSlug)
      if (floor <= limit) {
        nfts.forEach(async (nft) => {
          const tx = await this.listcNFT(
            nft.mint, nft.walletAddress, floor * percentage
          )
        })
      }
      return { floor, sold: floor * 0.9 }
    }, frequence)
    return id
  }
}

module.exports = { TensorClient }

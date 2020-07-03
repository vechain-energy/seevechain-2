const numeral = require('numeral')
const moment = require('moment')
const { oneDayAgo } = require('../lib/dateHelpers')

const cache = []

module.exports = async function(client) {
  const blockRecord = await client.one(
    `
      SELECT * FROM blocks
      ORDER BY timestamp DESC
      LIMIT 1;
    `
  )

  if (!blockRecord) throw new Error('no block found')

  if (cache[0] === blockRecord.number) {
    return cache[1]
  }

  const transactionsRecords = await client.query(
    `
      SELECT * FROM transactions
      WHERE block_number = $1;
    `,
    [blockRecord.number]
  )

  const before = oneDayAgo()

  const todaysStatsRecord = await client.one(
    `
      SELECT
        sum(transactions.vtho_burn) AS dailyVTHOBurn,
        count(transactions.*) AS dailyTransactions,
        sum(transactions.clauses) AS dailyClauses
      FROM blocks
      JOIN transactions
      ON blocks.number = transactions.block_number
      WHERE blocks.timestamp > $1;
    `,
    [before]
  )

  const monthlyStatsRecords = await client.query(`SELECT * FROM daily_stats ORDER BY day DESC LIMIT 30`)


  const now = moment()
  const serverTime = now.add((+process.env.TIME_DIFFERENCE), 'hours').format('MM/DD/YY, k:mm')

  cache[0] = blockRecord.number
  cache[1] = {
    block: {
      id: blockRecord.id,
      number: +blockRecord.number,
      parentId: blockRecord.parent_id,
      timestamp: blockRecord.timestamp,
      gasUsed: +blockRecord.gas_used,
      signer: blockRecord.signer,
    },
    transactions: transactionsRecords.map(transaction => ({
      id: transaction.id,
      blockNumber: +transaction.block_number,
      contracts: transaction.contracts,
      delegator: transaction.delegator,
      origin: transaction.origin,
      gas: +transaction.gas,
      clauses: +transaction.clauses,
      vthoBurn: +transaction.vtho_burn,
      gasUsed: +transaction.gas_used,
      paid: transaction.paid,
      reward: transaction.reward,
      types: transaction.types,
      transfers: numeral(transaction.transfers).format('0.00a'),
    })),
    stats: {
      dailyTransactions: +todaysStatsRecord.dailytransactions,
      dailyClauses: +todaysStatsRecord.dailyclauses,
      dailyVTHOBurn: +todaysStatsRecord.dailyvthoburn,
    },
    monthlyStats: monthlyStatsRecords.map(record => ({
      day: moment(record.day).format('YYYY-MM-DD'),
      vthoBurn: record.vtho_burn,
      transactionCount: record.transaction_count,
      clauseCount: record.clause_count,
    })),
    serverTime,
  }

  return cache[1]
}

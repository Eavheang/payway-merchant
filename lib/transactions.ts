type TransactionRecord = {
  amount: string
  clientId: string
  createdAt: number
  expiresAt: number
  idempotencyKey: string
  status: 'init' | 'approved' | 'failed' | 'expired'
  token: string
}

const transactionStore = new Map<string, TransactionRecord>()

const cleanupExpiredTransactions = () => {
  const now = Date.now()
  for (const [key, record] of transactionStore) {
    if (now >= record.expiresAt) transactionStore.delete(key)
  }
}

export const findTransactionByKey = (
  idempotencyKey: string,
): TransactionRecord | undefined => {
  if (transactionStore.size > 500) {
    cleanupExpiredTransactions()
  }
  return transactionStore.get(idempotencyKey)
}

export const createTransaction = (
  record: TransactionRecord,
): TransactionRecord => {
  transactionStore.set(record.idempotencyKey, record)
  return record
}

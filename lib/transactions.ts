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

export const findTransactionByClientId = (
  clientId: string,
): TransactionRecord | undefined => {
  for (const record of transactionStore.values()) {
    if (record.clientId === clientId) return record
  }
  return undefined
}

export const createTransaction = (
  record: TransactionRecord,
): TransactionRecord => {
  transactionStore.set(record.idempotencyKey, record)
  return record
}

export const updateTransactionStatus = (
  idempotencyKey: string,
  status: TransactionRecord['status'],
) => {
  const record = transactionStore.get(idempotencyKey)
  if (record) {
    transactionStore.set(idempotencyKey, { ...record, status })
  }
}

import mongoose from 'mongoose'

const refreshTokenSchema = new mongoose.Schema({
  token: { type: String, required: true, unique: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  expiresAt: { type: Date, required: true },
  replacedAt: { type: Date, default: null },
})

refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })
refreshTokenSchema.index(
  { replacedAt: 1 },
  { expireAfterSeconds: 86400, partialFilterExpression: { replacedAt: { $ne: null } } }
)

export const RefreshToken = mongoose.model('RefreshToken', refreshTokenSchema)


import mongoose from 'mongoose'

const passwordResetTokenSchema = new mongoose.Schema({
  tokenHash: { type: String, required: true, unique: true },
  userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  expiresAt: { type: Date, required: true },
})

passwordResetTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

export const PasswordResetToken = mongoose.model('PasswordResetToken', passwordResetTokenSchema)

import mongoose from 'mongoose'

let isConnected = false

export async function connectDB(): Promise<void> {
  if (isConnected) return

  const uri = process.env.MONGODB_URI
  if (!uri) {
    throw new Error(
      'MONGODB_URI is not set. Add it in Render → Environment (your Atlas connection string).'
    )
  }

  try {
    await mongoose.connect(uri)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown MongoDB error'
    throw new Error(
      `MongoDB connection failed: ${message}. ` +
        'In Atlas → Network Access, allow 0.0.0.0/0 (or Render outbound IPs) and verify MONGODB_URI.'
    )
  }

  isConnected = true
  console.log('MongoDB connected')
}

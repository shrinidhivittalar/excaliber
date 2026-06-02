import mongoose from 'mongoose'

const drawingVersionSchema = new mongoose.Schema({
  drawingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Drawing',
    required: true,
    index: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  versionNumber: {
    type: Number,
    required: true,
  },
  label: {
    type: String,
    default: 'Auto-save',
    maxlength: 60,
  },
  sceneJson: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
  },
  conversationHistory: {
    type: [mongoose.Schema.Types.Mixed],
    default: [],
  },
  elementCount: {
    type: Number,
    default: 0,
  },
}, {
  timestamps: true,
})

drawingVersionSchema.index({ drawingId: 1, versionNumber: -1 })

export const DrawingVersion = mongoose.model('DrawingVersion', drawingVersionSchema)

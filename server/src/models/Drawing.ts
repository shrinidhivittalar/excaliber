import mongoose from 'mongoose'

const drawingSchema = new mongoose.Schema({
  title: {
    type: String,
    default: 'Untitled Drawing',
    trim: true,
    maxlength: 100,
  },
  sceneJson: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
  },
  conversationHistory: {
    type: [mongoose.Schema.Types.Mixed],
    default: [],
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  shareId: {
    type: String,
    sparse: true,
    index: true,
  },
  isPublic: {
    type: Boolean,
    default: false,
  },
}, {
  timestamps: true,
})

export const Drawing = mongoose.model('Drawing', drawingSchema)

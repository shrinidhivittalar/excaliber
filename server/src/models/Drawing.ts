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
  folderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Folder',
    default: null,
    index: true,
  },
  tags: {
    type: [String],
    default: [],
    validate: {
      validator: (arr: string[]) => arr.length <= 10,
      message: 'Maximum 10 tags per drawing',
    },
  },
}, {
  timestamps: true,
})

drawingSchema.index({ title: 'text', tags: 'text' })

export const Drawing = mongoose.model('Drawing', drawingSchema)

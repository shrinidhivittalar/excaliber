import mongoose from 'mongoose'

const folderSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  color: {
    type: String,
    default: '#6366f1',
  },
}, {
  timestamps: true,
})

export const Folder = mongoose.model('Folder', folderSchema)

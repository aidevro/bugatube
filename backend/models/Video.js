const mongoose = require('mongoose');

const CommentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  text: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const VideoSchema = new mongoose.Schema({
  title: { type: String, required: true },
  channel: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Owner of the video
  filePaths: {
    low: { type: String, required: true },
    high: { type: String }
  },
  thumbnail: { type: String, required: true },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // Users who liked the video
  comments: [CommentSchema], // Comments on the video
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Video', VideoSchema);

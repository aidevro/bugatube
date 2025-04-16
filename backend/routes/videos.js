const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { execSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const Video = require('../models/Video');
const User = require('../models/User');
const WebSocket = require('ws');
const multer = require('multer');

const upload = multer({ dest: '/app/uploads/' });
const { app, wss } = require('../server');

// In-memory queue for tracking downloads
const downloadQueue = new Map(); // Map<videoId, { url, title, status, progress, userId, stage }>

const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    res.status(401).json({ error: 'Invalid token' });
  }
};

const validateObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id);
};

let totalDurationSec = null;

const encodeVideo = (inputPath, outputPath, width, bitrate, videoId, stage, totalStages) => {
  const process = spawn('ffmpeg', [
    '-vaapi_device', '/dev/dri/renderD128',
    '-i', inputPath,
    '-vf', `format=nv12,hwupload,scale_vaapi=${width}:-2`,
    '-c:v', 'h264_vaapi',
    '-b:v', bitrate,
    outputPath
  ]);

  return new Promise((resolve, reject) => {
    process.stderr.on('data', (data) => {
      const output = data.toString();
      
      // Capture total duration from ffmpeg output once
      if (!totalDurationSec) {
        const durationMatch = output.match(/Duration: (\d{2}):(\d{2}):(\d{2})/);
        if (durationMatch) {
          totalDurationSec = parseInt(durationMatch[1]) * 3600 + parseInt(durationMatch[2]) * 60 + parseInt(durationMatch[3]);
          console.log(`Total duration for video ${videoId} (${width}p): ${totalDurationSec} seconds`);
        }
      }

      const timeMatch = output.match(/time=(\d{2}:\d{2}:\d{2}\.\d{2})/);
      if (timeMatch && totalDurationSec) {
        const timeParts = timeMatch[1].split(':').map(parseFloat);
        const currentSec = timeParts[0] * 3600 + timeParts[1] * 60 + timeParts[2];
        const progress = Math.min((currentSec / totalDurationSec) * 100, 100);
        const stageProgress = (progress / totalStages) + ((stage - 1) * (100 / totalStages));

        console.log(`Encoding progress for video ${videoId} (${width}p): ${progress.toFixed(2)}%, Stage Progress: ${stageProgress.toFixed(2)}%`);

        downloadQueue.set(videoId, {
          ...downloadQueue.get(videoId),
          progress: stageProgress,
          stage: `Encoding ${width}p`
        });
        broadcastQueueUpdate(downloadQueue.get(videoId).userId);
      }
    });

    process.on('close', (code) => {
      totalDurationSec = null; // Reset for next call
      if (code !== 0) {
        try {
          execSync(`ffmpeg -i "${inputPath}" -vf scale=${width}:-2 -c:v libx264 -preset veryfast -b:v ${bitrate} "${outputPath}"`);
          console.log(`Encoded ${outputPath} with CPU (libx264)`);
          downloadQueue.set(videoId, { ...downloadQueue.get(videoId), progress: (stage * 100) / totalStages, stage: `Encoding ${width}p` });
          broadcastQueueUpdate(downloadQueue.get(videoId).userId);
          resolve();
        } catch (err) {
          reject(err);
        }
      } else {
        console.log(`Encoded ${outputPath} with VAAPI`);
        resolve();
      }
    });
  });
};

router.post('/upload', authMiddleware, upload.single('video'), async (req, res) => {
  try {
    const { title } = req.body;
    if (!req.file || !title) return res.status(400).json({ error: 'Video and title required' });

    const videoId = new mongoose.Types.ObjectId().toString();
    const uploadDir = path.join('/app/uploads', videoId);
    fs.mkdirSync(uploadDir, { recursive: true });

    const inputPath = req.file.path;
    const lowPath = path.join(uploadDir, 'low.mp4');
    const highPath = path.join(uploadDir, 'high.mp4');
    const thumbnailPath = path.join(uploadDir, 'thumbnail.jpg');

    await encodeVideo(inputPath, lowPath, 320, '1M', videoId, 1, 3);
    await encodeVideo(inputPath, highPath, 1920, '5M', videoId, 2, 3);
    execSync(`ffmpeg -i "${inputPath}" -vf "select=eq(n\\,0)" -q:v 3 "${thumbnailPath}"`);

    const video = new Video({
      _id: videoId,
      title,
      uploadedBy: req.user.id,
      filePaths: { low: `/uploads/${videoId}/low.mp4`, high: `/uploads/${videoId}/high.mp4` },
      thumbnail: `/uploads/${videoId}/thumbnail.jpg`,
      channel: req.user.id,
    });
    await video.save();

    fs.unlinkSync(inputPath);
    res.json({ message: 'Video uploaded successfully' });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Upload failed' });
  }
});

router.post('/youtube', authMiddleware, async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL required' });

    const videoId = new mongoose.Types.ObjectId().toString();
    const title = execSync(`yt-dlp --cookies "/cookies.txt" --get-title "${url}"`).toString().trim();
    console.log(`Fetched title: ${title}`);

    downloadQueue.set(videoId, { url, title, status: 'pending', progress: 0, userId: req.user.id, stage: 'Downloading' });
    broadcastQueueUpdate(req.user.id);

    res.json({ message: 'YouTube video added to queue' });

    setImmediate(async () => {
      try {
        const uploadDir = path.join('/app/uploads', videoId);
        fs.mkdirSync(uploadDir, { recursive: true });

        const outputPath = path.join('/app/uploads', videoId, 'video.mp4');
        console.log(`Attempting to download ${url} to ${outputPath}`);

        const ytDlpProcess = spawn('yt-dlp', [
          '--cookies', '/cookies.txt',
          '-f', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
          '--merge-output-format', 'mp4',
          '-o', outputPath,
          url,
          '--verbose'
        ]);

        ytDlpProcess.stderr.on('data', (data) => {
          const output = data.toString();
          const progressMatch = output.match(/\[download\]\s+(\d{1,3}\.\d)%/);
          if (progressMatch) {
            const progress = parseFloat(progressMatch[1]) / 3; // Download is 1/3 of the process
            console.log(`Download progress for video ${videoId}: ${progress.toFixed(2)}%`);
            downloadQueue.set(videoId, { 
              ...downloadQueue.get(videoId),
              progress,
              stage: 'Downloading'
            });
            broadcastQueueUpdate(req.user.id);
          }
        });

        ytDlpProcess.stdout.on('data', (data) => console.log('yt-dlp stdout:', data.toString()));
        ytDlpProcess.stderr.on('data', (data) => console.error('yt-dlp stderr:', data.toString()));

        await new Promise((resolve, reject) => {
          ytDlpProcess.on('close', (code) => {
            if (code !== 0) {
              reject(new Error(`yt-dlp process exited with code ${code}`));
            } else {
              resolve();
            }
          });
        });

        console.log(`Download completed: ${outputPath}`);
        if (!fs.existsSync(outputPath)) {
          const files = fs.readdirSync(uploadDir);
          console.log(`Files in directory ${uploadDir}:`, files);
          const downloadedFile = files.find(file => file.startsWith('video.mp4'));
          if (downloadedFile) {
            const actualPath = path.join(uploadDir, downloadedFile);
            console.log(`Found file with different extension: ${actualPath}`);
            const tempPath = path.join(uploadDir, 'temp.mp4');
            execSync(`ffmpeg -i "${actualPath}" -c:v libx264 -c:a aac -f mp4 "${tempPath}"`);
            fs.renameSync(tempPath, outputPath);
            console.log(`Converted ${actualPath} to ${outputPath}`);
            fs.unlinkSync(actualPath);
          } else {
            throw new Error(`Downloaded file not found: ${outputPath}`);
          }
        }

        const lowPath = path.join(uploadDir, 'low.mp4');
        const highPath = path.join(uploadDir, 'high.mp4');
        const thumbnailPath = path.join(uploadDir, 'thumbnail.jpg');

        await encodeVideo(outputPath, lowPath, 320, '1M', videoId, 2, 3);
        await encodeVideo(outputPath, highPath, 1920, '5M', videoId, 3, 3);
        execSync(`ffmpeg -i "${outputPath}" -vf "select=eq(n\\,0)" -q:v 3 "${thumbnailPath}"`);

        const video = new Video({
          _id: videoId,
          title,
          uploadedBy: req.user.id,
          filePaths: { low: `/uploads/${videoId}/low.mp4`, high: `/uploads/${videoId}/high.mp4` },
          thumbnail: `/uploads/${videoId}/thumbnail.jpg`,
          channel: req.user.id,
        });
        await video.save();

        fs.unlinkSync(outputPath);
        downloadQueue.set(videoId, { ...downloadQueue.get(videoId), status: 'completed', progress: 100, stage: 'Completed' });
        broadcastQueueUpdate(req.user.id);
      } catch (err) {
        console.error('YouTube download error:', err);
        downloadQueue.set(videoId, { ...downloadQueue.get(videoId), status: 'failed', progress: 0, stage: 'Failed' });
        broadcastQueueUpdate(req.user.id);
        const uploadDir = path.join('/app/uploads', videoId);
        if (fs.existsSync(uploadDir)) {
          fs.rmSync(uploadDir, { recursive: true });
        }
      }
    });
  } catch (err) {
    console.error('YouTube queue error:', err);
    res.status(500).json({ error: err.message || 'Failed to queue download' });
  }
});

router.get('/queue', authMiddleware, async (req, res) => {
  try {
    const userQueue = Array.from(downloadQueue.entries())
      .filter(([_, item]) => item.userId === req.user.id)
      .map(([videoId, item]) => ({ videoId, ...item }));
    res.json(userQueue);
  } catch (err) {
    console.error('Get queue error:', err);
    res.status(500).json({ error: 'Failed to fetch queue status' });
  }
});

router.delete('/queue/failed', authMiddleware, async (req, res) => {
  try {
    downloadQueue.forEach((item, videoId) => {
      if (item.userId === req.user.id && item.status === 'failed') {
        downloadQueue.delete(videoId);
      }
    });
    broadcastQueueUpdate(req.user.id);
    res.json({ message: 'Failed downloads cleared' });
  } catch (err) {
    console.error('Clear failed queue error:', err);
    res.status(500).json({ error: 'Failed to clear failed downloads' });
  }
});

router.get('/', async (req, res) => {
  try {
    const videos = await Video.find().populate('channel', 'email');
    res.json(videos);
  } catch (err) {
    console.error('Get videos error:', err);
    res.status(500).json({ error: 'Failed to fetch videos' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!validateObjectId(id)) {
      return res.status(400).json({ error: 'Invalid video ID' });
    }
    const video = await Video.findById(id).populate('channel', 'email').populate('comments.userId', 'email');
    if (!video) return res.status(404).json({ error: 'Video not found' });
    res.json(video);
  } catch (err) {
    console.error('Get video error:', err);
    res.status(500).json({ error: 'Failed to fetch video' });
  }
});

router.get('/channel/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    if (!validateObjectId(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }
    const videos = await Video.find({ uploadedBy: userId }).populate('channel', 'email');
    res.json(videos);
  } catch (err) {
    console.error('Get channel videos error:', err);
    res.status(500).json({ error: 'Failed to fetch channel videos' });
  }
});

router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    if (!validateObjectId(id)) {
      return res.status(400).json({ error: 'Invalid video ID' });
    }
    const video = await Video.findById(id);
    if (!video) return res.status(404).json({ error: 'Video not found' });
    if (video.uploadedBy.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    const uploadDir = path.join('/app/uploads', id);
    if (fs.existsSync(uploadDir)) fs.rmSync(uploadDir, { recursive: true });
    await Video.findByIdAndDelete(id);
    res.json({ message: 'Video deleted' });
  } catch (err) {
    console.error('Delete video error:', err);
    res.status(500).json({ error: 'Failed to delete video' });
  }
});

router.post('/:id/like', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    if (!validateObjectId(id)) {
      return res.status(400).json({ error: 'Invalid video ID' });
    }
    const video = await Video.findById(id);
    if (!video) return res.status(404).json({ error: 'Video not found' });
    const userId = req.user.id;
    const index = video.likes.indexOf(userId);
    if (index === -1) {
      video.likes.push(userId);
    } else {
      video.likes.splice(index, 1);
    }
    await video.save();
    res.json({ likes: video.likes });
  } catch (err) {
    console.error('Like video error:', err);
    res.status(500).json({ error: 'Failed to like video' });
  }
});

router.post('/:id/comment', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    if (!validateObjectId(id)) {
      return res.status(400).json({ error: 'Invalid video ID' });
    }
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'Comment text required' });
    const video = await Video.findById(id);
    if (!video) return res.status(404).json({ error: 'Video not found' });
    video.comments.push({ userId: req.user.id, text });
    await video.save();
    await video.populate('comments.userId', 'email');
    res.json({ comments: video.comments });
  } catch (err) {
    console.error('Comment error:', err);
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

router.delete('/:id/comment/:commentId', authMiddleware, async (req, res) => {
  try {
    const { id, commentId } = req.params;
    if (!validateObjectId(id) || !validateObjectId(commentId)) {
      return res.status(400).json({ error: 'Invalid video or comment ID' });
    }
    const video = await Video.findById(id);
    if (!video) return res.status(404).json({ error: 'Video not found' });
    const comment = video.comments.id(commentId);
    if (!comment) return res.status(404).json({ error: 'Comment not found' });
    if (comment.userId.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    video.comments = video.comments.filter(c => c._id.toString() !== commentId);
    await video.save();
    await video.populate('comments.userId', 'email');
    res.json({ comments: video.comments });
  } catch (err) {
    console.error('Delete comment error:', err);
    res.status(500).json({ error: 'Failed to delete comment' });
  }
});

// Broadcast queue updates to clients via WebSocket
const broadcastQueueUpdate = (userId) => {
  if (!wss || !wss.clients) {
    console.error('WebSocket server (wss) is not initialized properly');
    return;
  }
  const userQueue = Array.from(downloadQueue.entries())
    .filter(([_, item]) => item.userId === userId)
    .map(([videoId, item]) => ({ videoId, ...item }));
  console.log(`Broadcasting queue update to user ${userId}:`, userQueue);
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN && client.userId === userId) {
      client.send(JSON.stringify({ type: 'queueUpdate', queue: userQueue }));
    }
  });
};

module.exports = router;

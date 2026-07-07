const db = require('./src/config/database');
const authRoutes = require('./src/routes/authRoutes');
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const rateLimit = require('express-rate-limit');
require('dotenv').config();
const cron = require('node-cron');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

// Rate limiting
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // max 100 requests per 15 mins per IP
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // max 10 auth attempts per 15 mins per IP
  message: { error: 'Too many login attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(globalLimiter);

// Routes
app.use('/api/auth', authLimiter, authRoutes);

// Watermark endpoint
const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const os = require('os');

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

app.post('/api/watermark', async (req, res) => {
  const { media_url, media_type, username } = req.body;
  if (!media_url) return res.status(400).json({ error: 'media_url required' });

  const tmpDir = os.tmpdir();
  const ext = media_type === 'video' ? 'mp4' : 'jpg';
  const inputPath = path.join(tmpDir, `havvit_input_${Date.now()}.${ext}`);
  const outputPath = path.join(tmpDir, `havvit_output_${Date.now()}.${ext}`);

  try {
    // Download file from Cloudinary
    const response = await axios({ url: media_url, method: 'GET', responseType: 'stream' });
    const writer = fs.createWriteStream(inputPath);
    response.data.pipe(writer);
    await new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });

    const watermarkText = `Havvit  @${username || 'havvit'}`;

    if (media_type === 'video') {
      await new Promise((resolve, reject) => {
        ffmpeg(inputPath)
          .videoFilters([
            {
              filter: 'drawtext',
              options: {
                text: watermarkText,
                fontsize: 28,
                fontcolor: 'white',
                alpha: 0.85,
                x: '20',
                y: 'h-th-30',
                shadowcolor: 'black',
                shadowx: 2,
                shadowy: 2,
                box: 1,
                boxcolor: 'black@0.4',
                boxborderw: 8,
              },
            },
          ])
          .outputOptions(['-codec:a copy'])
          .save(outputPath)
          .on('end', resolve)
          .on('error', reject);
      });
    } else {
      await new Promise((resolve, reject) => {
        ffmpeg(inputPath)
          .videoFilters([
            {
              filter: 'drawtext',
              options: {
                text: watermarkText,
                fontsize: 24,
                fontcolor: 'white',
                alpha: 0.85,
                x: '20',
                y: 'h-th-20',
                shadowcolor: 'black',
                shadowx: 2,
                shadowy: 2,
                box: 1,
                boxcolor: 'black@0.4',
                boxborderw: 6,
              },
            },
          ])
          .save(outputPath)
          .on('end', resolve)
          .on('error', reject);
      });
    }

    res.setHeader('Content-Type', media_type === 'video' ? 'video/mp4' : 'image/jpeg');
    res.setHeader('Content-Disposition', `attachment; filename="havvit.${ext}"`);
    const stream = fs.createReadStream(outputPath);
    stream.pipe(res);
    stream.on('end', () => {
      fs.unlink(inputPath, () => {});
      fs.unlink(outputPath, () => {});
    });
  } catch (e) {
    console.log('Watermark error:', e.message);
    fs.unlink(inputPath, () => {});
    fs.unlink(outputPath, () => {});
    res.status(500).json({ error: 'Watermark failed' });
  }
});

// Watermark endpoint
const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const os = require('os');

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

app.post('/api/watermark', async (req, res) => {
  const { media_url, media_type, username } = req.body;
  if (!media_url) return res.status(400).json({ error: 'media_url required' });

  const tmpDir = os.tmpdir();
  const ext = media_type === 'video' ? 'mp4' : 'jpg';
  const inputPath = path.join(tmpDir, `havvit_input_${Date.now()}.${ext}`);
  const outputPath = path.join(tmpDir, `havvit_output_${Date.now()}.${ext}`);

  try {
    const response = await axios({ url: media_url, method: 'GET', responseType: 'stream' });
    const writer = fs.createWriteStream(inputPath);
    response.data.pipe(writer);
    await new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });

    const watermarkText = `Havvit  @${username || 'havvit'}`;

    await new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .videoFilters([{
          filter: 'drawtext',
          options: {
            text: watermarkText,
            fontsize: media_type === 'video' ? 28 : 24,
            fontcolor: 'white',
            alpha: 0.85,
            x: '20',
            y: 'h-th-30',
            shadowcolor: 'black',
            shadowx: 2,
            shadowy: 2,
            box: 1,
            boxcolor: 'black@0.4',
            boxborderw: 8,
          },
        }])
        .outputOptions(media_type === 'video' ? ['-codec:a copy'] : [])
        .save(outputPath)
        .on('end', resolve)
        .on('error', reject);
    });

    res.setHeader('Content-Type', media_type === 'video' ? 'video/mp4' : 'image/jpeg');
    res.setHeader('Content-Disposition', `attachment; filename="havvit.${ext}"`);
    const stream = fs.createReadStream(outputPath);
    stream.pipe(res);
    stream.on('end', () => {
      fs.unlink(inputPath, () => {});
      fs.unlink(outputPath, () => {});
    });
  } catch (e) {
    console.log('Watermark error:', e.message);
    fs.unlink(inputPath, () => {});
    fs.unlink(outputPath, () => {});
    res.status(500).json({ error: 'Watermark failed', details: e.message });
  }
});

// Test route
app.get('/', (req, res) => {
  res.json({
    message: 'VYBE API is running! 🚀',
    version: '1.0.0',
    status: 'online',
  });
});

// Socket.io
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join_room', (room) => {
    socket.join(room);
    console.log(`User joined room: ${room}`);
  });

  socket.on('send_message', (data) => {
    io.to(data.room).emit('receive_message', data);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// ── SCHEDULED POSTS CRON JOB ─────────────────────────────────────
// Runs every minute, checks for posts that should be published
cron.schedule('* * * * *', async () => {
  try {
    const now = new Date().toISOString();
    const { data: scheduledPosts, error } = await supabase
      .from('posts')
      .select('id')
      .eq('status', 'scheduled')
      .lte('scheduled_for', now);

    if (error) {
      console.log('Scheduled posts cron error:', error.message);
      return;
    }

    if (!scheduledPosts || scheduledPosts.length === 0) return;

    const ids = scheduledPosts.map(p => p.id);
    const { error: updateError } = await supabase
      .from('posts')
      .update({ status: 'published' })
      .in('id', ids);

    if (updateError) {
      console.log('Scheduled posts update error:', updateError.message);
    } else {
      console.log(`✅ Published ${ids.length} scheduled post(s)`);
    }
  } catch (err) {
    console.log('Cron job error:', err.message);
  }
});

// Keep server awake on Render free tier
const https = require('https');
setInterval(() => {
  https.get('https://vybe-backend-vt91.onrender.com', (res) => {
    console.log('Server kept alive:', res.statusCode);
  }).on('error', (err) => {
    console.log('Keep alive error:', err.message);
  });
}, 14 * 60 * 1000); // Every 14 minutes

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`VYBE Server running on port ${PORT} 🚀`);
});
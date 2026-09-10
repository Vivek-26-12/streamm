import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import fs from 'fs';

import authRoutes from './routes/authRoutes.js';
import movieRoutes from './routes/movieRoutes.js';
import { detectEncoders } from './services/transcode/transcodeService.js';

dotenv.config();

const PORT = process.env.PORT || 5000;

// Create folders if they don't exist
const folders = [
  'd:\\Songs\\Pendrive\\movies\\Streamm\\backend\\movies',
  'd:\\Songs\\Pendrive\\movies\\Streamm\\backend\\cache\\posters',
  'd:\\Songs\\Pendrive\\movies\\Streamm\\backend\\cache\\transcode',
  'd:\\Songs\\Pendrive\\movies\\Streamm\\backend\\cache\\subtitles'
];
folders.forEach(f => {
  if (!fs.existsSync(f)) {
    fs.mkdirSync(f, { recursive: true });
  }
});

const app = express();
app.set('trust proxy', 1);
const server = http.createServer(app);

// Security & CORS
app.use(helmet({
  crossOriginResourcePolicy: false,
  crossOriginEmbedderPolicy: false
}));

app.use(cors({
  origin: (origin, callback) => {
    // Dynamically mirror any request origin to fully support credentials: true
    callback(null, true);
  },
  credentials: true
}));

app.use(express.json());

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path.includes('/stream')
});
app.use('/api', limiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api', movieRoutes);

// Healthcheck
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date() });
});

// Unhandled error handler
app.use((err, req, res, next) => {
  console.error('Unhandled Error:', err.message);
  res.status(500).json({ error: 'Internal server error.' });
});

// Initialize server and detect encoders
server.listen(PORT, async () => {
  console.log(`\n==================================================`);
  console.log(`Streamm dynamic media server running on http://localhost:${PORT}`);
  console.log(`==================================================\n`);

  await detectEncoders();
});

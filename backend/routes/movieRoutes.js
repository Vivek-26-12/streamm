import express from 'express';
import { 
  getMovies, 
  getMovieById, 
  getPoster, 
  getSubtitle, 
  triggerScan
} from '../controllers/movieController.js';
import { streamMovie } from '../controllers/streamController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Enforce authentication globally
router.use(authenticateToken);

router.get('/movies', getMovies);
router.get('/movie/:id', getMovieById);
router.get('/movie/:id/poster', getPoster);
router.get('/movie/:id/subtitle', getSubtitle);
router.get('/movie/:id/stream', streamMovie);

router.post('/scan', triggerScan);

export default router;

import express from 'express';
import { login, validateToken, logout } from '../controllers/authController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.post('/login', login);
router.get('/validate', authenticateToken, validateToken);
router.post('/logout', authenticateToken, logout);

export default router;

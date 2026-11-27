import { Router } from 'express';
import { verifyPigeonSignature } from '../middleware/auth.js';
import { handlePigeonWebhook } from '../controllers/webhookController.js';

const router = Router();

router.post('/pigeon', verifyPigeonSignature, handlePigeonWebhook);

export default router;

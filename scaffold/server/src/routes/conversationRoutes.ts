import { Router } from 'express';
import { listConversations } from '../controllers/conversationController.js';

const router = Router();

router.get('/', listConversations);

export default router;

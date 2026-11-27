import { Router } from 'express';
import {
  listConversations,
  claimConversation,
  releaseConversation,
  updateConversationStatus,
  replyConversation,
} from '../controllers/conversationController.js';

const router = Router();

router.get('/', listConversations);
router.post('/:contact/claim', claimConversation);
router.post('/:contact/release', releaseConversation);
router.post('/:contact/status', updateConversationStatus);
router.post('/:contact/reply', replyConversation);

export default router;

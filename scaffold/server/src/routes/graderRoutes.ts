import { Router } from 'express';
import { requireGraderToken } from '../middleware/auth.js';
import { reset, snapshot, claim, reply } from '../controllers/graderController.js';

const router = Router();

router.use(requireGraderToken);

router.post('/reset', reset);
router.get('/snapshot', snapshot);
router.post('/claim', claim);
router.post('/reply', reply);

export default router;

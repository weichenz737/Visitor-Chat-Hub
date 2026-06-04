import { Router, type IRouter } from "express";
import healthRouter from "./health";
import sessionsRouter from "./sessions";
import messagesRouter from "./messages";
import agentRouter from "./agent";
import uploadRouter from "./upload";

const router: IRouter = Router();

router.use(healthRouter);
router.use(sessionsRouter);
router.use(messagesRouter);
router.use(agentRouter);
router.use(uploadRouter);

export default router;

import { Router, type IRouter } from "express";
import healthRouter from "./health";
import sessionsRouter from "./sessions";
import messagesRouter from "./messages";
import agentRouter from "./agent";
import adminRouter from "./admin";
import quickRepliesRouter from "./quick-replies";
import uploadRouter from "./upload";
import storageRouter from "./storage";

const router: IRouter = Router();

router.use(healthRouter);
router.use(sessionsRouter);
router.use(messagesRouter);
router.use(agentRouter);
router.use(adminRouter);
router.use(quickRepliesRouter);
router.use(uploadRouter);
router.use(storageRouter);

export default router;

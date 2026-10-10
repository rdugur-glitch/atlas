import { Router, type IRouter } from "express";
import atlasRouter from "./atlas";
import accountRouter from "./account";

// The health route is mounted in app.ts, ahead of the Clerk middleware.
const router: IRouter = Router();

router.use("/atlas/account", accountRouter);
router.use("/atlas", atlasRouter);

export default router;

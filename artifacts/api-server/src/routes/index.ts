import { Router, type IRouter } from "express";
import healthRouter from "./health";
import atlasRouter from "./atlas";
import accountRouter from "./account";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/atlas/account", accountRouter);
router.use("/atlas", atlasRouter);

export default router;

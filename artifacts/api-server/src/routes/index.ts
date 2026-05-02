import { Router, type IRouter } from "express";
import healthRouter from "./health";
import usersRouter from "./users";
import locationsRouter from "./locations";
import weatherRouter from "./weather";
import agricultureRouter from "./agriculture";
import fieldNotesRouter from "./fieldNotes";
import alertsRouter from "./alerts";
import subscriptionsRouter from "./subscriptions";
import dashboardRouter from "./dashboard";

const router: IRouter = Router();

router.use(healthRouter);
router.use(usersRouter);
router.use(locationsRouter);
router.use(weatherRouter);
router.use(agricultureRouter);
router.use(fieldNotesRouter);
router.use(alertsRouter);
router.use(subscriptionsRouter);
router.use(dashboardRouter);

export default router;

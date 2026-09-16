import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import usersRouter from "./users";
import organizationsRouter from "./organizations";
import sectorsRouter from "./sectors";
import positionsRouter from "./positions";
import projectsRouter from "./projects";
import projectMembersRouter from "./project-members";
import stagesRouter from "./stages";
import tasksRouter from "./tasks";
import commentsRouter from "./comments";
import attachmentsRouter from "./attachments";
import dashboardRouter from "./dashboard";
import notificationsRouter from "./notifications";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(usersRouter);
router.use(organizationsRouter);
router.use(sectorsRouter);
router.use(positionsRouter);
router.use(projectsRouter);
router.use(projectMembersRouter);
router.use(stagesRouter);
router.use(tasksRouter);
router.use(commentsRouter);
router.use(attachmentsRouter);
router.use(dashboardRouter);
router.use(notificationsRouter);

export default router;

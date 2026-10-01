import { Router } from "express";
import { getUserById, listUsers } from "./user.controller.js";

export const userRouter = Router();

userRouter.get("/users", listUsers);
userRouter.get("/users/:userId", getUserById);

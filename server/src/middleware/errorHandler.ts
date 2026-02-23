import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { config } from "../config.js";

export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: {
        message: "Invalid request",
        details: err.flatten()
      }
    });
  }

  if (err instanceof Error && err.message === "Not allowed by CORS") {
    return res.status(403).json({ error: { message: "CORS blocked" } });
  }

  if (config.nodeEnv !== "production") {
    console.error(err);
    if (err instanceof Error) {
      return res.status(500).json({
        error: {
          message: err.message
        }
      });
    }
  }

  return res.status(500).json({ error: { message: "Internal server error" } });
};

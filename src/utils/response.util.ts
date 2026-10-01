import type { Response } from "express";

export class ErrorResponse extends Error {
    constructor(public override message: string, public statusCode: number) {
      super(message);
      this.statusCode = statusCode;

      Error.captureStackTrace(this, this.constructor);
    }
  }
  
  export const SuccessResponse = (
    res: Response,
    message: string,
    data: any = {},
    statusCode: number = 200
  ) => {
    return res.status(statusCode).json({
      success: true,
      message,
      data: data,
    });
  };
  
  
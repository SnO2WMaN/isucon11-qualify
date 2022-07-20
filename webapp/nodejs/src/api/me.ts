import { Request, Response } from "express-serve-static-core";
import { ErrorWithStatus, pool } from "~/app";
import { getUserIdFromSession } from "~/commons/getUserIdFromSession";
import { GetMeResponse } from "~/types";

export const handlerMe = async (req: Request, res: Response) => {
  const db = await pool.getConnection();
  try {
    let jiaUserId: string;
    try {
      jiaUserId = await getUserIdFromSession(req, db);
    } catch (err) {
      if (err instanceof ErrorWithStatus && err.status === 401) {
        return res.status(401).type("text").send("you are not signed in");
      }
      console.error(err);
      return res.status(500).send();
    }

    const getMeResponse: GetMeResponse = { jia_user_id: jiaUserId };
    return res.status(200).json(getMeResponse);
  } finally {
    db.release();
  }
};

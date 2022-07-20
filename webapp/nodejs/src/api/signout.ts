import { Request, Response } from "express-serve-static-core";
import { ErrorWithStatus, pool } from "~/app";
import { getUserIdFromSession } from "~/commons/getUserIdFromSession";

export const handlerSignout = async (req: Request, res: Response) => {
  const db = await pool.getConnection();
  try {
    try {
      await getUserIdFromSession(req, db);
    } catch (err) {
      if (err instanceof ErrorWithStatus && err.status === 401) {
        return res.status(401).type("text").send("you are not signed in");
      }
      console.error(err);
      return res.status(500).send();
    }

    req.session = null;
    return res.status(200).send();
  } finally {
    db.release();
  }
};

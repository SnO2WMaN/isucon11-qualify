import { Request, Response } from "express";
import { RowDataPacket } from "mysql2/promise";
import { ErrorWithStatus, pool } from "~/app";
import { getUserIdFromSession } from "~/commons/getUserIdFromSession";

export const handlerGetIsuIcon = async (req: Request<{ jia_isu_uuid: string }>, res: Response) => {
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

    const jiaIsuUUID = req.params.jia_isu_uuid;
    const [[row]] = await db.query<(RowDataPacket & { image: Buffer })[]>(
      "SELECT `image` FROM `isu` WHERE `jia_user_id` = ? AND `jia_isu_uuid` = ?",
      [jiaUserId, jiaIsuUUID],
    );
    if (!row) {
      return res.status(404).type("text").send("not found: isu");
    }
    return res.status(200).send(row.image);
  } catch (err) {
    console.error(`db error: ${err}`);
    return res.status(500).send();
  } finally {
    db.release();
  }
};

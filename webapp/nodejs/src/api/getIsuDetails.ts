import express, { Response } from "express";
import { ErrorWithStatus, pool } from "~/app";
import { getUserIdFromSession } from "~/commons/getUserIdFromSession";
import { Isu, IsuResponse } from "~/types";

export const handlerGetIsuDetails = async (req: express.Request<{ jia_isu_uuid: string }>, res: Response) => {
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
    const [[isu]] = await db.query<Isu[]>(
      "SELECT * FROM `isu` WHERE `jia_user_id` = ? AND `jia_isu_uuid` = ?",
      [jiaUserId, jiaIsuUUID],
    );
    if (!isu) {
      return res.status(404).type("text").send("not found: isu");
    }
    const isuResponse: IsuResponse = {
      id: isu.id,
      jia_isu_uuid: isu.jia_isu_uuid,
      name: isu.name,
      character: isu.character,
    };
    return res.status(200).json(isuResponse);
  } catch (err) {
    console.error(`db error: ${err}`);
    return res.status(500).send();
  } finally {
    db.release();
  }
};

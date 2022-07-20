import { Request, Response } from "express";
import { RowDataPacket } from "mysql2/promise";
import { isValidConditionFormat } from "~/commons/isValidConditionFormat";

import { pool } from "../app";
interface PostIsuConditionRequest {
  is_sitting: boolean;
  condition: string;
  message: string;
  timestamp: number;
}

function isValidPostIsuConditionRequest(
  body: PostIsuConditionRequest[],
): body is PostIsuConditionRequest[] {
  return (
    Array.isArray(body)
    && body.every((data) => {
      return (
        typeof data.is_sitting === "boolean"
        && typeof data.condition === "string"
        && typeof data.message === "string"
        && typeof data.timestamp === "number"
      );
    })
  );
}

export const handlerPostIsuCondition = async (
  req: Request<
    { jia_isu_uuid: string },
    unknown,
    PostIsuConditionRequest[]
  >,
  res: Response,
) => {
  // TODO: 一定割合リクエストを落としてしのぐようにしたが、本来は全量さばけるようにすべき
  const dropProbability = 0.9;
  if (Math.random() <= dropProbability) {
    console.warn("drop post isu condition request");
    return res.status(202).send();
  }

  const db = await pool.getConnection();
  try {
    const jiaIsuUUID = req.params.jia_isu_uuid;

    const request = req.body;
    if (!isValidPostIsuConditionRequest(request) || request.length === 0) {
      return res.status(400).type("text").send("bad request body");
    }

    await db.beginTransaction();

    const [[{ cnt }]] = await db.query<(RowDataPacket & { cnt: number })[]>(
      "SELECT COUNT(*) AS `cnt` FROM `isu` WHERE `jia_isu_uuid` = ?",
      [jiaIsuUUID],
    );
    if (cnt === 0) {
      await db.rollback();
      return res.status(404).type("text").send("not found: isu");
    }

    for (const cond of request) {
      const timestamp = new Date(cond.timestamp * 1000);

      if (!isValidConditionFormat(cond.condition)) {
        await db.rollback();
        return res.status(400).type("text").send("bad request body");
      }

      await db.query(
        "INSERT INTO `isu_condition`"
          + "	(`jia_isu_uuid`, `timestamp`, `is_sitting`, `condition`, `message`)"
          + "	VALUES (?, ?, ?, ?, ?)",
        [jiaIsuUUID, timestamp, cond.is_sitting, cond.condition, cond.message],
      );
    }

    await db.commit();

    return res.status(202).send();
  } catch (err) {
    console.error(`db error: ${err}`);
    await db.rollback();
    return res.status(500).send();
  } finally {
    db.release();
  }
};

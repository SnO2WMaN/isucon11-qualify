import { Request, Response } from "express";
import { ErrorWithStatus, pool } from "~/app";
import { calculateConditionLevel } from "~/commons/calculateConditionLevel";
import { getUserIdFromSession } from "~/commons/getUserIdFromSession";
import { GetIsuListResponse, Isu, IsuCondition } from "~/types";

export const handlerGetIsu = async (req: Request, res: Response) => {
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

    await db.beginTransaction();

    const [isuList] = await db.query<Isu[]>(
      "SELECT * FROM `isu` WHERE `jia_user_id` = ? ORDER BY `id` DESC",
      [jiaUserId],
    );
    const responseList: Array<GetIsuListResponse> = [];
    for (const isu of isuList) {
      let foundLastCondition = true;
      const [[lastCondition]] = await db.query<IsuCondition[]>(
        "SELECT * FROM `isu_condition` WHERE `jia_isu_uuid` = ? ORDER BY `timestamp` DESC LIMIT 1",
        [isu.jia_isu_uuid],
      );
      if (!lastCondition) {
        foundLastCondition = false;
      }
      let formattedCondition = undefined;
      if (foundLastCondition) {
        const [conditionLevel, err] = calculateConditionLevel(
          lastCondition.condition,
        );
        if (err) {
          console.error(err);
          await db.rollback();
          return res.status(500).send();
        }
        formattedCondition = {
          jia_isu_uuid: lastCondition.jia_isu_uuid,
          isu_name: isu.name,
          timestamp: lastCondition.timestamp.getTime() / 1000,
          is_sitting: !!lastCondition.is_sitting,
          condition: lastCondition.condition,
          condition_level: conditionLevel,
          message: lastCondition.message,
        };
      }
      responseList.push({
        id: isu.id,
        jia_isu_uuid: isu.jia_isu_uuid,
        name: isu.name,
        character: isu.character,
        latest_isu_condition: formattedCondition,
      });
    }

    await db.commit();

    return res.status(200).json(responseList);
  } catch (err) {
    console.error(`db error: ${err}`);
    await db.rollback();
    return res.status(500).send();
  } finally {
    db.release();
  }
};

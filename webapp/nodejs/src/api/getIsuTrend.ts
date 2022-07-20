import { Request, Response } from "express";
import { RowDataPacket } from "mysql2/promise";
import { pool } from "~/app";
import { calculateConditionLevel } from "~/commons/calculateConditionLevel";
import { Isu, IsuCondition, TrendCondition, TrendResponse } from "~/types";

export const handlerGetIsuTrend = async (req: Request, res: Response) => {
  const db = await pool.getConnection();
  try {
    const [characterList] = await db.query<
      (RowDataPacket & { character: string })[]
    >("SELECT `character` FROM `isu` GROUP BY `character`");

    const trendResponse: TrendResponse[] = [];

    for (const character of characterList) {
      const [isuList] = await db.query<Isu[]>(
        "SELECT * FROM `isu` WHERE `character` = ?",
        [character.character],
      );

      const characterInfoIsuConditions = [];
      const characterWarningIsuConditions = [];
      const characterCriticalIsuConditions = [];
      for (const isu of isuList) {
        const [conditions] = await db.query<IsuCondition[]>(
          "SELECT * FROM `isu_condition` WHERE `jia_isu_uuid` = ? ORDER BY timestamp DESC",
          [isu.jia_isu_uuid],
        );

        if (conditions.length > 0) {
          const isuLastCondition = conditions[0];
          const [conditionLevel, err] = calculateConditionLevel(
            isuLastCondition.condition,
          );
          if (err) {
            console.error(err);
            return res.status(500).send();
          }
          const trendCondition: TrendCondition = {
            isu_id: isu.id,
            timestamp: isuLastCondition.timestamp.getTime() / 1000,
          };
          switch (conditionLevel) {
            case "info":
              characterInfoIsuConditions.push(trendCondition);
              break;
            case "warning":
              characterWarningIsuConditions.push(trendCondition);
              break;
            case "critical":
              characterCriticalIsuConditions.push(trendCondition);
              break;
          }
        }
      }

      characterInfoIsuConditions.sort((a, b) => b.timestamp - a.timestamp);
      characterWarningIsuConditions.sort((a, b) => b.timestamp - a.timestamp);
      characterCriticalIsuConditions.sort((a, b) => b.timestamp - a.timestamp);
      trendResponse.push({
        character: character.character,
        info: characterInfoIsuConditions,
        warning: characterWarningIsuConditions,
        critical: characterCriticalIsuConditions,
      });
    }

    return res.status(200).json(trendResponse);
  } catch (err) {
    console.error(`db error: ${err}`);
    return res.status(500).send();
  } finally {
    db.release();
  }
};

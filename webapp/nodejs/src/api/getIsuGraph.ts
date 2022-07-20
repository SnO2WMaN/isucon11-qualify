import { Request, Response } from "express";
import { RowDataPacket } from "mysql2/promise";
import { ErrorWithStatus, pool } from "~/app";
import { getUserIdFromSession } from "~/commons/getUserIdFromSession";
import { isValidConditionFormat } from "~/commons/isValidConditionFormat";
import { scoreConditionLevelCritical, scoreConditionLevelInfo, scoreConditionLevelWarning } from "~/constants";
import { GraphDataPoint, GraphDataPointWithInfo, GraphResponse, IsuCondition } from "~/types";

import mysql from "mysql2/promise";

export interface GetIsuGraphQuery extends qs.ParsedQs {
  datetime?: string;
}

async function generateIsuGraphResponse(
  db: mysql.Connection,
  jiaIsuUUID: string,
  graphDate: Date,
): Promise<[GraphResponse[], Error?]> {
  const dataPoints: GraphDataPointWithInfo[] = [];
  let conditionsInThisHour = [];
  let timestampsInThisHour = [];
  let startTimeInThisHour = new Date(0);

  const [rows] = await db.query<IsuCondition[]>(
    "SELECT * FROM `isu_condition` WHERE `jia_isu_uuid` = ? ORDER BY `timestamp` ASC",
    [jiaIsuUUID],
  );
  for (const condition of rows) {
    const truncatedConditionTime = new Date(condition.timestamp);
    truncatedConditionTime.setMinutes(0, 0, 0);
    if (truncatedConditionTime.getTime() !== startTimeInThisHour.getTime()) {
      if (conditionsInThisHour.length > 0) {
        const [data, err] = calculateGraphDataPoint(conditionsInThisHour);
        if (err) {
          return [[], err];
        }
        dataPoints.push({
          jiaIsuUUID,
          startAt: startTimeInThisHour,
          data,
          conditionTimeStamps: timestampsInThisHour,
        });
      }
      startTimeInThisHour = truncatedConditionTime;
      conditionsInThisHour = [];
      timestampsInThisHour = [];
    }
    conditionsInThisHour.push(condition);
    timestampsInThisHour.push(condition.timestamp.getTime() / 1000);
  }

  if (conditionsInThisHour.length > 0) {
    const [data, err] = calculateGraphDataPoint(conditionsInThisHour);
    if (err) {
      return [[], err];
    }
    dataPoints.push({
      jiaIsuUUID,
      startAt: startTimeInThisHour,
      data,
      conditionTimeStamps: timestampsInThisHour,
    });
  }

  const endTime = new Date(graphDate.getTime() + 24 * 3600 * 1000);
  let startIndex = dataPoints.length;
  let endNextIndex = dataPoints.length;
  dataPoints.forEach((graph, i) => {
    if (startIndex === dataPoints.length && graph.startAt >= graphDate) {
      startIndex = i;
    }
    if (endNextIndex === dataPoints.length && graph.startAt > endTime) {
      endNextIndex = i;
    }
  });

  const filteredDataPoints: GraphDataPointWithInfo[] = [];
  if (startIndex < endNextIndex) {
    filteredDataPoints.push(...dataPoints.slice(startIndex, endNextIndex));
  }

  const responseList: GraphResponse[] = [];
  let index = 0;
  let thisTime = graphDate;

  while (thisTime < endTime) {
    let data = undefined;
    const timestamps: number[] = [];

    if (index < filteredDataPoints.length) {
      const dataWithInfo = filteredDataPoints[index];
      if (dataWithInfo.startAt.getTime() === thisTime.getTime()) {
        data = dataWithInfo.data;
        timestamps.push(...dataWithInfo.conditionTimeStamps);
        index++;
      }
    }

    responseList.push({
      start_at: thisTime.getTime() / 1000,
      end_at: thisTime.getTime() / 1000 + 3600,
      data,
      condition_timestamps: timestamps,
    });

    thisTime = new Date(thisTime.getTime() + 3600 * 1000);
  }

  return [responseList, undefined];
}

// 複数のISUのコンディションからグラフの一つのデータ点を計算
function calculateGraphDataPoint(
  isuConditions: IsuCondition[],
): [GraphDataPoint, Error?] {
  const conditionsCount: Record<string, number> = {
    is_broken: 0,
    is_dirty: 0,
    is_overweight: 0,
  };
  let rawScore = 0;
  isuConditions.forEach((condition) => {
    let badConditionsCount = 0;

    if (!isValidConditionFormat(condition.condition)) {
      return [{}, new Error("invalid condition format")];
    }

    condition.condition.split(",").forEach((condStr) => {
      const keyValue = condStr.split("=");

      const conditionName = keyValue[0];
      if (keyValue[1] === "true") {
        conditionsCount[conditionName] += 1;
        badConditionsCount++;
      }
    });

    if (badConditionsCount >= 3) {
      rawScore += scoreConditionLevelCritical;
    } else if (badConditionsCount >= 1) {
      rawScore += scoreConditionLevelWarning;
    } else {
      rawScore += scoreConditionLevelInfo;
    }
  });

  let sittingCount = 0;
  isuConditions.forEach((condition) => {
    if (condition.is_sitting) {
      sittingCount++;
    }
  });

  const isuConditionLength = isuConditions.length;
  const score = Math.trunc((rawScore * 100) / 3 / isuConditionLength);
  const sittingPercentage = Math.trunc(
    (sittingCount * 100) / isuConditionLength,
  );
  const isBrokenPercentage = Math.trunc(
    (conditionsCount["is_broken"] * 100) / isuConditionLength,
  );
  const isOverweightPercentage = Math.trunc(
    (conditionsCount["is_overweight"] * 100) / isuConditionLength,
  );
  const isDirtyPercentage = Math.trunc(
    (conditionsCount["is_dirty"] * 100) / isuConditionLength,
  );

  const dataPoint: GraphDataPoint = {
    score,
    percentage: {
      sitting: sittingPercentage,
      is_broken: isBrokenPercentage,
      is_overweight: isOverweightPercentage,
      is_dirty: isDirtyPercentage,
    },
  };
  return [dataPoint, undefined];
}

export const handlerGetIsuGraph = async (
  req: Request<
    { jia_isu_uuid: string },
    unknown,
    never,
    GetIsuGraphQuery
  >,
  res: Response,
) => {
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
    const datetimeStr = req.query.datetime;
    if (!datetimeStr) {
      return res.status(400).type("text").send("missing: datetime");
    }
    const datetime = parseInt(datetimeStr, 10);
    if (isNaN(datetime)) {
      return res.status(400).type("text").send("bad format: datetime");
    }
    const date = new Date(datetime * 1000);
    date.setMinutes(0, 0, 0);

    await db.beginTransaction();

    const [[{ cnt }]] = await db.query<(RowDataPacket & { cnt: number })[]>(
      "SELECT COUNT(*) AS `cnt` FROM `isu` WHERE `jia_user_id` = ? AND `jia_isu_uuid` = ?",
      [jiaUserId, jiaIsuUUID],
    );
    if (cnt === 0) {
      await db.rollback();
      return res.status(404).type("text").send("not found: isu");
    }
    const [getIsuGraphResponse, e] = await generateIsuGraphResponse(
      db,
      jiaIsuUUID,
      date,
    );
    if (e) {
      console.error(e);
      await db.rollback();
      return res.status(500).send();
    }

    await db.commit();

    return res.status(200).json(getIsuGraphResponse);
  } catch (err) {
    console.error(`db error: ${err}`);
    await db.rollback();
    return res.status(500).send();
  } finally {
    db.release();
  }
};

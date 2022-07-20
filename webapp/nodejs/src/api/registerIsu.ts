import axios from "axios";
import { Request, Response } from "express";
import { readFile } from "fs/promises";
import { MulterError } from "multer";
import mysql from "mysql2/promise";
import { ErrorWithStatus, pool, postIsuConditionTargetBaseURL, upload } from "~/app";
import { getUserIdFromSession } from "~/commons/getUserIdFromSession";
import { defaultIconFilePath, defaultJIAServiceUrl, mysqlErrNumDuplicateEntry } from "~/constants";
import { Config, Isu, IsuResponse } from "~/types";

export interface PostIsuRequest {
  jia_isu_uuid: string;
  isu_name: string;
}

export async function getJIAServiceUrl(db: mysql.Connection): Promise<string> {
  const [[config]] = await db.query<Config[]>(
    "SELECT * FROM `isu_association_config` WHERE `name` = ?",
    ["jia_service_url"],
  );
  if (!config) {
    return defaultJIAServiceUrl;
  }
  return config.url;
}

export const handlerRegisterIsu = (
  req: Request<Record<string, never>, unknown, PostIsuRequest>,
  res: Response,
) => {
  upload.single("image")(req, res, async (uploadErr) => {
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

      const request = req.body;
      const jiaIsuUUID = request.jia_isu_uuid;
      const isuName = request.isu_name;
      if (uploadErr instanceof MulterError) {
        return res.send(400).send("bad format: icon");
      }

      const image = req.file
        ? req.file.buffer
        : await readFile(defaultIconFilePath);

      await db.beginTransaction();

      try {
        await db.query(
          "INSERT INTO `isu` (`jia_isu_uuid`, `name`, `image`, `jia_user_id`) VALUES (?, ?, ?, ?)",
          [jiaIsuUUID, isuName, image, jiaUserId],
        );
      } catch (err) {
        await db.rollback();
        if (err.errno === mysqlErrNumDuplicateEntry) {
          return res.status(409).type("text").send("duplicated: isu");
        } else {
          console.error(`db error: ${err}`);
          return res.status(500).send();
        }
      }

      const targetUrl = (await getJIAServiceUrl(db)) + "/api/activate";

      let isuFromJIA: { character: string };
      try {
        const response = await axios.post(
          targetUrl,
          {
            target_base_url: postIsuConditionTargetBaseURL,
            isu_uuid: jiaIsuUUID,
          },
          {
            validateStatus: (status) => status < 500,
          },
        );
        if (response.status !== 202) {
          console.error(
            `JIAService returned error: status code ${response.status}, message: ${response.data}`,
          );
          await db.rollback();
          return res
            .status(response.status)
            .type("text")
            .send("JIAService returned error");
        }
        isuFromJIA = response.data;
      } catch (err) {
        console.error(`failed to request to JIAService: ${err}`);
        await db.rollback();
        return res.status(500).send();
      }

      await db.query(
        "UPDATE `isu` SET `character` = ? WHERE  `jia_isu_uuid` = ?",
        [isuFromJIA.character, jiaIsuUUID],
      );
      const [[isu]] = await db.query<Isu[]>(
        "SELECT * FROM `isu` WHERE `jia_user_id` = ? AND `jia_isu_uuid` = ?",
        [jiaUserId, jiaIsuUUID],
      );

      await db.commit();

      const isuResponse: IsuResponse = {
        id: isu.id,
        jia_isu_uuid: isu.jia_isu_uuid,
        name: isu.name,
        character: isu.character,
      };
      return res.status(201).send(isuResponse);
    } catch (err) {
      console.error(`db error: ${err}`);
      await db.rollback();
      return res.status(500).send();
    } finally {
      db.release();
    }
  });
};

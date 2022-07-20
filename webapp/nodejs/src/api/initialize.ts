import { spawn } from "child_process";
import { Request, Response } from "express";
import { pool } from "~/app";

function isValidPostInitializeRequest(
  body: PostInitializeRequest,
): body is PostInitializeRequest {
  return typeof body === "object" && typeof body.jia_service_url === "string";
}

interface InitializeResponse {
  language: string;
}

interface PostInitializeRequest {
  jia_service_url: string;
}

export const handlerInitialize = async (
  req: Request<Record<string, never>, unknown, PostInitializeRequest>,
  res: Response,
) => {
  const request = req.body;
  if (!isValidPostInitializeRequest(request)) {
    return res.status(400).type("text").send("bad request body");
  }

  try {
    await new Promise((resolve, reject) => {
      const cmd = spawn("../sql/init.sh");
      cmd.stdout.pipe(process.stderr);
      cmd.stderr.pipe(process.stderr);
      cmd.on("exit", (code) => {
        resolve(code);
      });
      cmd.on("error", (err) => {
        reject(err);
      });
    });
  } catch (err) {
    console.error(`exec init.sh error: ${err}`);
    return res.status(500).send();
  }

  const db = await pool.getConnection();
  try {
    await db.query(
      "INSERT INTO `isu_association_config` (`name`, `url`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `url` = VALUES(`url`)",
      ["jia_service_url", request.jia_service_url],
    );
  } catch (err) {
    console.error(`db error: ${err}`);
    return res.status(500).send();
  } finally {
    db.release();
  }

  const initializeResponse: InitializeResponse = { language: "nodejs" };
  return res.status(200).json(initializeResponse);
};

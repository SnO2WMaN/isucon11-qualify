import express from "express";
import mysql, { RowDataPacket } from "mysql2/promise";
import { ErrorWithStatus } from "~/app";

export async function getUserIdFromSession(
  req: express.Request,
  db: mysql.Connection,
): Promise<string> {
  if (!req.session) {
    throw new ErrorWithStatus(500, "failed to get session");
  }
  const jiaUserId = req.session["jia_user_id"];
  if (!jiaUserId) {
    throw new ErrorWithStatus(401, "no session");
  }

  let cnt: number;
  try {
    [[{ cnt }]] = await db.query<(RowDataPacket & { cnt: number })[]>(
      "SELECT COUNT(*) AS `cnt` FROM `user` WHERE `jia_user_id` = ?",
      [jiaUserId],
    );
  } catch (err) {
    throw new ErrorWithStatus(500, `db error: ${err}`);
  }
  if (cnt === 0) {
    throw new ErrorWithStatus(401, "not found: user");
  }
  return jiaUserId;
}

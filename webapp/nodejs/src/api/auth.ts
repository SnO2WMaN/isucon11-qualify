import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { pool } from "~/app";

export const handlerAuth = async (req: Request, res: Response) => {
  const db = await pool.getConnection();
  try {
    const authHeader = req.headers.authorization ?? "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : authHeader;

    let decoded: jwt.JwtPayload;
    try {
      decoded = jwt.verify(token, req.app.get("cert")) as jwt.JwtPayload;
    } catch (err) {
      return res.status(403).type("text").send("forbidden");
    }

    const jiaUserId = decoded["jia_user_id"];
    if (typeof jiaUserId !== "string") {
      return res.status(400).type("text").send("invalid JWT payload");
    }

    await db.query("INSERT IGNORE INTO user (`jia_user_id`) VALUES (?)", [
      jiaUserId,
    ]);
    req.session = { jia_user_id: jiaUserId };

    return res.status(200).send();
  } catch (err) {
    console.error(`db error: ${err}`);
    return res.status(500).send();
  } finally {
    db.release();
  }
};

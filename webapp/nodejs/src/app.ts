import session from "cookie-session";
import express from "express";
import { readFileSync } from "fs";
import morgan from "morgan";
import multer from "multer";
import mysql from "mysql2/promise";
import path from "path";
import { handlerAuth } from "./api/auth";
import { handlerGetIsu } from "./api/getIsu";
import { handlerGetIsuCondition } from "./api/getIsuCondition";
import { handlerGetIsuDetails } from "./api/getIsuDetails";
import { handlerGetIsuGraph } from "./api/getIsuGraph";
import { handlerGetIsuIcon } from "./api/getIsuIcon";
import { handlerGetIsuTrend } from "./api/getIsuTrend";
import { handlerInitialize } from "./api/initialize";
import { handlerMe } from "./api/me";
import { handlerRegisterIsu } from "./api/registerIsu";
import { handlerPostIsuCondition } from "./api/registerIsuCond";
import { handlerSignout } from "./api/signout";
import { frontendContentsPath, jiaJWTSigningKeyPath, sessionName } from "./constants";

if (!("POST_ISUCONDITION_TARGET_BASE_URL" in process.env)) {
  console.error("missing: POST_ISUCONDITION_TARGET_BASE_URL");
  process.exit(1);
}
export const postIsuConditionTargetBaseURL = process.env["POST_ISUCONDITION_TARGET_BASE_URL"];
const dbinfo: mysql.PoolOptions = {
  host: process.env["MYSQL_HOST"] ?? "127.0.0.1",
  port: parseInt(process.env["MYSQL_PORT"] ?? "3306", 10),
  user: process.env["MYSQL_USER"] ?? "isucon",
  database: process.env["MYSQL_DBNAME"] ?? "isucondition",
  password: process.env["MYSQL_PASS"] || "isucon",
  connectionLimit: 10,
  timezone: "+09:00",
};
export const pool = mysql.createPool(dbinfo);
export const upload = multer();

const app = express();

app.use(morgan("combined"));
app.use("/assets", express.static(frontendContentsPath + "/assets"));
app.use(express.json());
app.use(
  session({
    secret: process.env["SESSION_KEY"] ?? "isucondition",
    name: sessionName,
    maxAge: 60 * 60 * 24 * 1000 * 30,
  }),
);
app.set("cert", readFileSync(jiaJWTSigningKeyPath));
app.set("etag", false);

export class ErrorWithStatus extends Error {
  public status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = new.target.name;
    this.status = status;
  }
}

// POST /initialize
// サービスを初期化
app.post("/initialize", handlerInitialize);

// POST /api/auth
// サインアップ・サインイン
app.post("/api/auth", handlerAuth);

// POST /api/signout
// サインアウト
app.post("/api/signout", handlerSignout);

// GET /api/user/me
// サインインしている自分自身の情報を取得
app.get("/api/user/me", handlerMe);

// GET /api/isu
// ISUの一覧を取得
app.get("/api/isu", handlerGetIsu);

// POST /api/isu
// ISUを登録
app.post("/api/isu", handlerRegisterIsu);

// GET /api/isu/:jia_isu_uuid
// ISUの情報を取得
app.get("/api/isu/:jia_isu_uuid", handlerGetIsuDetails);

// GET /api/isu/:jia_isu_uuid/icon
// ISUのアイコンを取得
app.get("/api/isu/:jia_isu_uuid/icon", handlerGetIsuIcon);

// GET /api/isu/:jia_isu_uuid/graph
// ISUのコンディショングラフ描画のための情報を取得
app.get("/api/isu/:jia_isu_uuid/graph", handlerGetIsuGraph);

// GET /api/condition/:jia_isu_uuid
// ISUのコンディションを取得
app.get("/api/condition/:jia_isu_uuid", handlerGetIsuCondition);

// GET /api/trend
// ISUの性格毎の最新のコンディション情報
app.get("/api/trend", handlerGetIsuTrend);

// POST /api/condition/:jia_isu_uuid
// ISUからのコンディションを受け取る
app.post("/api/condition/:jia_isu_uuid", handlerPostIsuCondition);

[
  "/",
  "/isu/:jia_isu_uuid",
  "/isu/:jia_isu_uuid/condition",
  "/isu/:jia_isu_uuid/graph",
  "/register",
].forEach((frontendPath) => {
  app.get(frontendPath, (_req, res) => {
    res.sendFile(path.resolve("../public", "index.html"));
  });
});

app.listen(parseInt(process.env["SERVER_APP_PORT"] ?? "3000", 10));

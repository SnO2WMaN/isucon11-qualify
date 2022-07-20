import { RowDataPacket } from "mysql2/promise";

export interface Config extends RowDataPacket {
  name: string;
  url: string;
}

export interface IsuResponse {
  id: number;
  jia_isu_uuid: string;
  name: string;
  character: string;
}

export interface Isu extends IsuResponse, RowDataPacket {
  image: Buffer;
  jia_user_id: string;
  created_at: Date;
  updated_at: Date;
}

export interface GetIsuListResponse {
  id: number;
  jia_isu_uuid: string;
  name: string;
  character: string;
  latest_isu_condition?: GetIsuConditionResponse;
}

export interface IsuCondition extends RowDataPacket {
  id: number;
  jia_isu_uuid: string;
  timestamp: Date;
  is_sitting: number;
  condition: string;
  message: string;
  created_at: Date;
}

export interface GetMeResponse {
  jia_user_id: string;
}
export interface GraphResponse {
  start_at: number;
  end_at: number;
  data?: GraphDataPoint;
  condition_timestamps: number[];
}
export interface GraphDataPoint {
  score: number;
  percentage: ConditionsPercentage;
}
interface ConditionsPercentage {
  sitting: number;
  is_broken: number;
  is_dirty: number;
  is_overweight: number;
}
export interface GraphDataPointWithInfo {
  jiaIsuUUID: string;
  startAt: Date;
  data: GraphDataPoint;
  conditionTimeStamps: number[];
}

export interface GetIsuConditionResponse {
  jia_isu_uuid: string;
  isu_name: string;
  timestamp: number;
  is_sitting: boolean;
  condition: string;
  condition_level: string;
  message: string;
}

export interface TrendResponse {
  character: string;
  info: TrendCondition[];
  warning: TrendCondition[];
  critical: TrendCondition[];
}

export interface TrendCondition {
  isu_id: number;
  timestamp: number;
}

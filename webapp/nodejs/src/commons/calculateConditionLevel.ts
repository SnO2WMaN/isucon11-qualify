import { conditionLevelCritical, conditionLevelInfo, conditionLevelWarning } from "~/constants";

// ISUのコンディションの文字列からコンディションレベルを計算

export function calculateConditionLevel(condition: string): [string, Error?] {
  let conditionLevel: string;
  const warnCount = (() => {
    let count = 0;
    let pos = 0;
    while (pos !== -1) {
      pos = condition.indexOf("=true", pos);
      if (pos >= 0) {
        count += 1;
        pos += 5;
      }
    }
    return count;
  })();
  switch (warnCount) {
    case 0:
      conditionLevel = conditionLevelInfo;
      break;
    case 1: // fallthrough
    case 2:
      conditionLevel = conditionLevelWarning;
      break;
    case 3:
      conditionLevel = conditionLevelCritical;
      break;
    default:
      return ["", new Error("unexpected warn count")];
  }
  return [conditionLevel, undefined];
}

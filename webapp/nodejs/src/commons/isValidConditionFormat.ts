// ISUのコンディションの文字列がcsv形式になっているか検証
export function isValidConditionFormat(condition: string): boolean {
  const keys = ["is_dirty=", "is_overweight=", "is_broken="];
  const valueTrue = "true";
  const valueFalse = "false";

  let idxCondStr = 0;

  for (const [idxKeys, key] of keys.entries()) {
    if (!condition.slice(idxCondStr).startsWith(key)) {
      return false;
    }
    idxCondStr += key.length;

    if (condition.slice(idxCondStr).startsWith(valueTrue)) {
      idxCondStr += valueTrue.length;
    } else if (condition.slice(idxCondStr).startsWith(valueFalse)) {
      idxCondStr += valueFalse.length;
    } else {
      return false;
    }

    if (idxKeys < keys.length - 1) {
      if (condition[idxCondStr] !== ",") {
        return false;
      }
      idxCondStr++;
    }
  }

  return idxCondStr === condition.length;
}

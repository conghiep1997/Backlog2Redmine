(function (global) {
  function isEmpty(value) {
    return value === undefined || value === null || String(value).trim() === "";
  }

  function formatToday(timezone, format) {
    const now = new Date();
    const date = new Date(now.toLocaleString("en-US", { timeZone: timezone }));
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return format.replace("yyyy", year).replace("MM", month).replace("dd", day);
  }

  function convertOneRow(row) {
    if (!row || !Array.isArray(row)) {
      return null;
    }

    const no = row[0];
    const type = row[1];
    const targetFeature = row[2];
    const feature = row[3];
    const screen = row[4];
    const precondition = row[5];
    const scenario1 = row[6];
    const scenario2 = row[7];
    const scenario3 = row[8];
    const scenario4 = row[9];
    const expectedDisplay = row[10];
    const expectedTransition = row[11];

    if (
      isEmpty(no) &&
      isEmpty(type) &&
      isEmpty(targetFeature) &&
      isEmpty(feature) &&
      isEmpty(screen) &&
      isEmpty(precondition) &&
      isEmpty(scenario1)
    ) {
      return null;
    }

    const level2 = targetFeature || feature || "";
    const level3 = type || "";
    const level4 = screen || "";

    const level5 = [scenario1, scenario2, scenario3, scenario4]
      .filter((value) => !isEmpty(value))
      .join("\n");

    const level6 = "";
    const level7 = expectedDisplay || "";
    const level8 = expectedTransition || "";
    const date = formatToday("Asia/Tokyo", "yyyy/MM/dd");

    return [
      no || "",
      level2,
      level3,
      level4,
      precondition || "",
      level5,
      level6,
      level7,
      level8,
      date,
    ];
  }

  function convertRows(rows, startRowIndex) {
    if (!rows || !Array.isArray(rows)) {
      return [];
    }

    const converted = [];
    for (let i = startRowIndex; i < rows.length; i++) {
      const result = convertOneRow(rows[i]);
      if (result) {
        converted.push(result);
      }
    }
    return converted;
  }

  global.TB_TESTCASE_CONVERTER = {
    isEmpty,
    formatToday,
    convertOneRow,
    convertRows,
  };
})(globalThis);

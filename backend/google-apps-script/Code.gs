const SPREADSHEET_ID = "1rQnVZ7ZUJRQLYY3BMHlt7u_k4wYUcoE2sDhvSEwdwJw";

// Keep using your current Apps Script if it already works.
// This file is included as the matching backend reference for the dashboard ZIP.
function doGet(e) {
  try {
    const data = buildCdawgRecipeData_();
    const callback = e && e.parameter && e.parameter.callback;
    const json = JSON.stringify(data);
    return ContentService.createTextOutput(callback ? `${callback}(${json});` : json)
      .setMimeType(callback ? ContentService.MimeType.JAVASCRIPT : ContentService.MimeType.JSON);
  } catch (err) {
    const callback = e && e.parameter && e.parameter.callback;
    const payload = JSON.stringify({ error: true, message: String(err) });
    return ContentService.createTextOutput(callback ? `${callback}(${payload});` : payload)
      .setMimeType(callback ? ContentService.MimeType.JAVASCRIPT : ContentService.MimeType.JSON);
  }
}

// Use the working backend code already deployed in Apps Script if you don't need to replace it.

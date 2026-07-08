# Square Authorization Fix

The dashboard error `You do not have permission to call UrlFetchApp.fetch` is coming from Apps Script, not GitHub.

Do this in Apps Script:

1. Open the Apps Script project.
2. Paste/update `Code.gs`.
3. Project Settings → turn on `Show "appsscript.json" manifest file in editor`.
4. Open `appsscript.json` and paste the manifest from this folder.
5. Save.
6. In the function dropdown, choose `authorizeSquareFetch_`.
7. Click Run.
8. Approve permissions.
9. Then choose `testSquareConnection_` and Run. Check Logs.
10. Deploy → Manage deployments → Edit → New version → Deploy.

Do not put the Square token in GitHub.

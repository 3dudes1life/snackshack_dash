SNACKOS V200 — CLOUDFLARE CONNECTION

1. Cloudflare > Workers & Pages > snackshack-sync-api > Edit code.
2. Replace the sample Worker code with worker.js and Deploy.
3. Storage & databases > D1 > snackshack-sync > Console.
4. Paste all of schema.sql and click Execute.
5. Confirm the Worker binding is named DB and points to snackshack-sync.
6. Optional: Worker Settings > Variables and Secrets:
   - ALLOWED_ORIGINS (plain text): your exact dashboard URL(s), comma-separated.
   - SYNC_API_KEY (secret): optional shared key.
7. Open the Worker Overview and copy its workers.dev URL.
8. In dashboard data/config.js set SNACKSHACK_SYNC_API_URL to that URL.
9. If you created SYNC_API_KEY, place the same value in SNACKSHACK_SYNC_API_KEY. Note: a key in browser code is only a shared gate, not a true private secret. Cloudflare Access is recommended later for strong authentication.
10. Upload the dashboard ZIP to GitHub/Cloudflare Pages. Open two devices and change a planner batch. Both will synchronize within 15 seconds or immediately after Sync now.

The dashboard remains fully functional in Local Mode before steps 1–9 are complete.

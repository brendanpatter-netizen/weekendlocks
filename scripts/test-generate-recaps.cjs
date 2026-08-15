// One-off local test for api/generate-weekly-recaps.js — invokes the job
// directly (bypassing the HTTP handler/CRON_SECRET check) using .env.local.
// Not part of the app; safe to delete after verifying the feature works.
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env.local") });
const { runWeeklyRecapJob } = require("../api/generate-weekly-recaps.js");

runWeeklyRecapJob()
  .then((result) => {
    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  })
  .catch((err) => {
    console.error("FAILED:", err);
    process.exit(1);
  });

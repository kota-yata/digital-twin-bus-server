import express from "express";
import { nextAcrossAll, shapeItem } from "./nextbus.js";

export const app = express();

app.get("/bus", (req, res) => {
  const now = new Date();
  const items = nextAcrossAll(now, 5).map(it => shapeItem(now, it, process.env.TZ || "Asia/Tokyo"));
  res.json({ from: now.toISOString(), count: items.length, items });
});

const port = process.env.PORT || 3000;

if (process.env.NODE_ENV !== "test") {
  app.listen(port, () => {
    console.log(`listening on :${port}`);
  });
}

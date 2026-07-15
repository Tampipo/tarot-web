import { env } from "./env";
import { buildApp } from "./app";
import { ensureAdmin } from "./lib/bootstrap";

buildApp()
  .then(async (app) => {
    await ensureAdmin(app.log);
    await app.listen({ port: env.PORT, host: "0.0.0.0" });
    app.log.info(`Tarot API listening on :${env.PORT}`);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

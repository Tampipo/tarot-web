import { env } from "./env";
import { buildApp } from "./app";

buildApp()
  .then((app) =>
    app.listen({ port: env.PORT, host: "0.0.0.0" }).then(() => {
      app.log.info(`Tarot API listening on :${env.PORT}`);
    }),
  )
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

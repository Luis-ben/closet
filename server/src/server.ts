import "dotenv/config";
import { buildApp } from "./app";
import { assertProductionReady } from "./utils/productionGuard";

async function main(): Promise<void> {
  assertProductionReady();

  const app = await buildApp();
  const port = Number(process.env.PORT ?? 3000);
  const host = process.env.HOST ?? "0.0.0.0";

  await app.listen({ port, host });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

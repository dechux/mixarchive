import { MixArchiveDatabase } from "../lib/database.js";

const database = new MixArchiveDatabase();

try {
  const tables = database.db
    .prepare(`
      SELECT name
      FROM sqlite_master
      WHERE type = 'table'
      ORDER BY name
    `)
    .all();

  console.log("SQLite database initialized.");
  console.log("");
  console.log("Tables:");

  for (const table of tables) {
    console.log(`- ${table.name}`);
  }

  console.log("");
  console.log("Database path:");
  console.log(database.dbPath);
} catch (error) {
  console.error("Database test failed.");
  console.error(error);
  process.exitCode = 1;
} finally {
  database.close();
}
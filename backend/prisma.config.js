import path from "node:path";
import "dotenv/config";

export default {
  schema: path.join("prisma", "schema.prisma"),
  datasource: {
    url: process.env.DATABASE_URL || "postgresql://localhost:5432/kanban_db",
  },
};

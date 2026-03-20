import { join, dirname } from "path";
import { fileURLToPath } from "url";

const path = fileURLToPath(import.meta.url);

export default {
  root: join(dirname(path), "client"),
  plugins: [],
  server: {
    allowedHosts: ["albert-server.tail2d72e9.ts.net"],
  },
};

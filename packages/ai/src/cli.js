import readline from "node:readline";
import { createButler, createMockRuntime, DeviceRouter } from "./index.js";
import { loadEnv } from "./env.js";

loadEnv();

const runtime = createMockRuntime();
const router = new DeviceRouter(runtime);
const butler = createButler({
  router,
  mode: process.env.AI_MODE || "auto",
});

console.log(`OmniLink AI butler ready (${butler.mode}).`);
console.log("Try: lock the lab door / unlock the lab door / what devices do I have / turn on the booth light");
console.log("Type exit to quit.\n");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: "you > ",
});

rl.prompt();

rl.on("line", async (line) => {
  const text = line.trim();
  if (text === "exit" || text === "quit") return rl.close();

  if (text) {
    try {
      const result = await butler.chatDetailed(text, { userAddress: "demo-owner" });
      console.log("butler >", result.reply);
      if (result.toolResults.length > 0) {
        console.log("tools  >", JSON.stringify(result.toolResults, null, 2));
      }
      console.log("");
    } catch (err) {
      console.error("error  >", err.message, "\n");
    }
  }

  rl.prompt();
});

rl.on("close", () => process.exit(0));

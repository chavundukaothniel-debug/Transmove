import { handler } from "../netlify/functions/trusted-api.js";

let input = "";
process.stdin.setEncoding("utf8");

process.stdin.on("data", (chunk) => {
  input += chunk;
});

process.stdin.on("end", async () => {
  try {
    const event = input ? JSON.parse(input) : {};
    const result = await handler(event, {});
    process.stdout.write(JSON.stringify(result));
  } catch (err) {
    process.stdout.write(
      JSON.stringify({
        statusCode: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: err.message })
      })
    );
  }
});

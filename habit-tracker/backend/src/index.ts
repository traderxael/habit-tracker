import { createApp } from "./app.js";

const port = Number(process.env.PORT ?? 3001);
createApp().listen(port, () => {
  console.log(`Backend escuchando en http://localhost:${port} (${process.env.NODE_ENV ?? "development"})`);
});

// Función serverless de Vercel: expone la API Express (solo-API) bajo /api/*.
// Vercel preserva la URL original (req.url = /api/...), así que los routers de
// createApp() montados en /api/... coinciden sin reescritura de prefijo.
// Si en un despliegue real la plataforma recortara el prefijo /api, el fix es
// re-anteponerlo aquí antes de despachar; se documenta para no re-diagnosticar.
import { createApp } from "../backend/dist/app.js";

export default createApp();

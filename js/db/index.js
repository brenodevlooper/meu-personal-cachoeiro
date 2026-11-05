/* Escolhe o adaptador: Supabase se config.js tiver as chaves; senão, modo demonstração. */
import { MODO_DEMO } from "../config.js";

export const db = MODO_DEMO ? (await import("./local.js")).db : (await import("./supabase.js")).db;

import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
export const ref = "kgxyfphjnaondupjakfj";
const raw = execFileSync(
  "powershell.exe",
  [
    "-NoProfile",
    "-Command",
    `supabase projects api-keys --project-ref ${ref} -o json`,
  ],
  { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
);
const keys = JSON.parse(raw);
const url = `https://${ref}.supabase.co`;
const options = { auth: { persistSession: false, autoRefreshToken: false } };
export const admin = createClient(
  url,
  keys.find((k) => k.name === "service_role").api_key,
  options,
);
export const publicClient = () =>
  createClient(url, keys.find((k) => k.name === "anon").api_key, options);

import { createClient } from "npm:@supabase/supabase-js@2.116.0";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Content-Type": "application/json",
};

function response(body: object, status = 200) {
  return new Response(JSON.stringify(body), { status, headers });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (request.method !== "POST") return response({ error: "Método no permitido." }, 405);

  const authorization = request.headers.get("Authorization") ?? "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!token) return response({ error: "Inicia sesión nuevamente." }, 401);

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return response({ error: "Servicio no configurado." }, 503);

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: authData, error: authError } = await admin.auth.getUser(token);
  if (authError || !authData.user)
    return response({ error: "Inicia sesión nuevamente." }, 401);

  let purpose: "entrada" | "salida";
  try {
    const body = await request.json();
    if (body?.purpose !== "entrada" && body?.purpose !== "salida")
      return response({ error: "Tipo de asistencia inválido." }, 400);
    purpose = body.purpose;
  } catch {
    return response({ error: "Solicitud inválida." }, 400);
  }

  const { data: profile, error: profileError } = await admin
    .from("atenza_profiles")
    .select("role")
    .eq("id", authData.user.id)
    .single();
  if (profileError || profile?.role !== "member")
    return response({ error: "Usa una cuenta de usuario para registrar asistencia." }, 403);

  const { data, error } = await admin.rpc("atenza_verified_check_in", {
    p_user: authData.user.id,
    p_kind: purpose,
  });
  if (error) return response({ error: error.message }, 409);
  return response({ recorded: true, id: data });
});

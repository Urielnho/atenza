import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { admin, publicClient } from "./cloud-client.mjs";
const ids = [];
const clients = [];
let noticeId;
async function account(role) {
  const email = `atenza-test-${randomUUID()}@example.com`;
  const password = randomUUID() + "aZ9!";
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: "Prueba temporal ATENZA" },
  });
  assert.ifError(error);
  ids.push(data.user.id);
  if (role !== "member") {
    const result = await admin
      .from("atenza_profiles")
      .update({ role })
      .eq("id", data.user.id);
    assert.ifError(result.error);
  }
  const client = publicClient();
  clients.push(client);
  assert.ifError(
    (await client.auth.signInWithPassword({ email, password })).error,
  );
  return client;
}
try {
  const member = await account("member");
  const other = await account("member");
  const manager = await account("admin");
  const display = await account("display");
  const anon = publicClient();
  clients.push(anon);
  assert.ok(
    (await anon.from("atenza_attendance").select()).error,
    "Anónimos sin acceso",
  );
  assert.ok(
    (
      await member
        .from("atenza_profiles")
        .update({ role: "admin" })
        .eq("id", ids[0])
    ).error,
    "No puede elevar privilegios",
  );
  assert.ok(
    (
      await member
        .from("atenza_notices")
        .insert({ title: "No permitido", body: "No permitido" })
    ).error,
  );
  assert.ok(
    (
      await member
        .from("atenza_attendance")
        .insert({ user_id: ids[0], kind: "entrada" })
    ).error,
  );
  assert.ok((await member.rpc("atenza_check_in", { p_kind: "salida" })).error);
  assert.ok(
    (await display.rpc("atenza_check_in", { p_kind: "entrada" })).error,
  );
  assert.ok((await member.rpc("atenza_check_in", { p_kind: "otro" })).error);
  assert.ok(
    (await member.rpc("atenza_check_in", { p_kind: "entrada" })).error,
    "El cliente no puede usar la ruta anterior",
  );
  assert.ok(
    (
      await member.rpc("atenza_verified_check_in", {
        p_user: ids[0],
        p_kind: "entrada",
      })
    ).error,
    "Solo el servicio puede registrar verificaciones",
  );
  const verified = (kind) =>
    admin.rpc("atenza_verified_check_in", { p_user: ids[0], p_kind: kind });
  assert.ok((await verified("salida")).error, "Salida sin entrada rechazada");
  assert.ok((await verified("otro")).error, "Tipo inválido rechazado");
  const pair = await Promise.all([verified("entrada"), verified("entrada")]);
  assert.equal(
    pair.filter((r) => !r.error).length,
    1,
    "Una sola entrada concurrente",
  );
  assert.ok((await verified("salida")).error, "Evita doble toque rápido");
  const own = await member.from("atenza_attendance").select();
  assert.ifError(own.error);
  assert.equal(own.data.length, 1);
  const foreign = await other.from("atenza_attendance").select();
  assert.ifError(foreign.error);
  assert.equal(foreign.data.length, 0);
  const view = await display
    .from("atenza_attendance")
    .select()
    .eq("user_id", ids[0]);
  assert.ifError(view.error);
  assert.equal(view.data.length, 1);
  let resolveEvent;
  const event = new Promise((resolve) => {
    resolveEvent = resolve;
  });
  const channel = display
    .channel("test-" + randomUUID())
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "atenza_notices" },
      resolveEvent,
    );
  await new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("Realtime no confirmó la escucha de PostgreSQL")),
      30000,
    );
    channel
      .on("system", {}, (payload) => {
        if (
          payload.extension === "postgres_changes" &&
          payload.status === "ok"
        ) {
          clearTimeout(timer);
          resolve();
        }
      })
      .subscribe((status, error) => {
        if (status === "CHANNEL_ERROR") {
          clearTimeout(timer);
          reject(error || new Error(status));
        }
      });
  });
  const inserted = await manager
    .from("atenza_notices")
    .insert({
      title: "Prueba temporal",
      body: "Se elimina al terminar la verificación.",
    })
    .select()
    .single();
  assert.ifError(inserted.error);
  noticeId = inserted.data.id;
  let timer;
  await Promise.race([
    event,
    new Promise((_, reject) => {
      timer = setTimeout(
        () => reject(new Error("No llegó evento Realtime")),
        15000,
      );
    }),
  ]);
  clearTimeout(timer);
  assert.ifError(
    (
      await manager
        .from("atenza_notices")
        .update({ title: "Prueba editada" })
        .eq("id", noticeId)
    ).error,
  );
  // Move only this test account's record back in time to exercise valid checkout.
  assert.ifError(
    (
      await admin
        .from("atenza_attendance")
        .update({ created_at: new Date(Date.now() - 60000).toISOString() })
        .eq("user_id", ids[0])
    ).error,
  );
  assert.ifError((await verified("salida")).error);
  assert.ifError(
    (await manager.from("atenza_notices").delete().eq("id", noticeId)).error,
  );
  noticeId = undefined;
  console.log(
    "PASS: roles, RLS, aislamiento, entrada/salida, concurrencia, duplicados, avisos y Realtime.",
  );
} finally {
  for (const client of clients) {
    await client.removeAllChannels();
    await client.auth.signOut();
  }
  if (noticeId) {
    const { error } = await admin
      .from("atenza_notices")
      .delete()
      .eq("id", noticeId);
    assert.ifError(error);
  }
  if (ids.length) {
    const { error } = await admin
      .from("atenza_attendance")
      .delete()
      .in("user_id", ids);
    assert.ifError(error);
  }
  for (const id of ids)
    assert.ifError((await admin.auth.admin.deleteUser(id)).error);
  console.log("Datos y cuentas temporales eliminados.");
}

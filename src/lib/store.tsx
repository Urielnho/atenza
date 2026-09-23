import {
  createContext,
  PropsWithChildren,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AppState } from "react-native";
import { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
export type Profile = {
  id: string;
  full_name: string;
  role: "member" | "admin" | "display";
};
export type Notice = {
  id: string;
  title: string;
  body: string;
  created_at: string;
};
export type Attendance = {
  id: string;
  user_id: string;
  kind: "entrada" | "salida";
  created_at: string;
  profiles?: { full_name: string } | null;
};
type State = {
  session: Session | null;
  profile: Profile | null;
  notices: Notice[];
  attendance: Attendance[];
  status: string;
  loading: boolean;
  refresh: () => Promise<void>;
};
const Context = createContext<State>({
  session: null,
  profile: null,
  notices: [],
  attendance: [],
  status: "",
  loading: true,
  refresh: async () => {},
});
export const useData = () => useContext(Context);
export function Provider({ children }: PropsWithChildren) {
  const activeUser = useRef<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [status, setStatus] = useState(
    supabase ? "Conectando" : "Vista previa · nube pendiente",
  );
  const [loading, setLoading] = useState(!!supabase);
  async function refresh() {
    if (!supabase || !session) return;
    const requestedUser = session.user.id;
    const [p, n, a] = await Promise.all([
      supabase
        .from("atenza_profiles")
        .select("*")
        .eq("id", session.user.id)
        .single(),
      supabase
        .from("atenza_notices")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("atenza_attendance")
        .select("*, profiles:atenza_profiles(full_name)")
        .order("created_at", { ascending: false })
        .limit(100),
    ]);
    if (activeUser.current !== requestedUser) return;
    const error = p.error || n.error || a.error;
    if (error) {
      setStatus("Sin sincronizar: " + error.message);
      return;
    }
    setProfile(p.data);
    setNotices(n.data || []);
    setAttendance(a.data || []);
  }
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data, error }) => {
      activeUser.current = data.session?.user.id ?? null;
      setSession(data.session);
      setLoading(false);
      if (error) setStatus(error.message);
      else if (!data.session) setStatus("Inicia sesión para conectar");
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      if (activeUser.current !== (next?.user.id ?? null)) {
        setProfile(null);
        setAttendance([]);
        setNotices([]);
      }
      activeUser.current = next?.user.id ?? null;
      setSession(next);
      setLoading(false);
      if (!next) {
        setStatus("Inicia sesión para conectar");
        setProfile(null);
        setAttendance([]);
        setNotices([]);
      }
    });
    const listener = AppState.addEventListener("change", (state) => {
      if (state === "active") supabase?.auth.startAutoRefresh();
      else supabase?.auth.stopAutoRefresh();
    });
    return () => {
      data.subscription.unsubscribe();
      listener.remove();
    };
  }, []);
  useEffect(() => {
    if (!supabase || !session) return;
    let alive = true;
    let ready = false;
    const reload = () => {
      if (alive) void refresh();
    };
    reload();
    const channel = supabase
      .channel("atenza-live")
      .on("system", {}, (payload) => {
        if (
          alive &&
          payload.extension === "postgres_changes" &&
          payload.status === "ok"
        ) {
          ready = true;
          setStatus("En tiempo real");
          reload();
        }
      })
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "atenza_notices" },
        reload,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "atenza_attendance" },
        reload,
      )
      .subscribe((state) => {
        if (state !== "SUBSCRIBED") ready = false;
        if (alive)
          setStatus(
            state === "SUBSCRIBED"
              ? ready
                ? "En tiempo real"
                : "Sincronizando"
              : "Reconectando",
          );
      });
    const poll = setInterval(reload, 30000);
    return () => {
      alive = false;
      clearInterval(poll);
      void supabase?.removeChannel(channel);
    };
    // Reload subscriptions only when the authenticated user changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user.id]);
  return (
    <Context.Provider
      value={{
        session,
        profile,
        notices,
        attendance,
        status,
        loading,
        refresh,
      }}
    >
      {children}
    </Context.Provider>
  );
}

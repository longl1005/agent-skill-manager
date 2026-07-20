import { useEffect } from "react";
import { ping } from "../ipc/commands";

export default function Dashboard() {
  useEffect(() => {
    ping().then((res) => console.log(res.message));
  }, []);

  return (
    <section className="page">
      <h1>Dashboard</h1>
      <p className="empty-hint">Run scan to discover agents.</p>
    </section>
  );
}

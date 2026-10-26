import { useEffect, useState } from "react";
export default function HeaderClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const timer = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(timer); }, []);
  const parts = new Intl.DateTimeFormat("uz-UZ", { timeZone: "Asia/Tashkent", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).formatToParts(now);
  const part = (type) => parts.find((item) => item.type === type)?.value;
  return <time className="header-clock" dateTime={now.toISOString()}><strong>{part("hour")}:{part("minute")}<span className="header-clock-seconds">:{part("second")}</span></strong><small>{now.toLocaleDateString("uz-UZ", { timeZone: "Asia/Tashkent", day: "2-digit", month: "2-digit", year: "numeric" })}</small></time>;
}

// HARNESS: the doc wraps the root layout; a route layout is used so other routes are unaffected.
import { Providers } from "./providers";

export default function ComponentsLayout({ children }: { children: React.ReactNode }) {
  return <Providers>{children}</Providers>;
}

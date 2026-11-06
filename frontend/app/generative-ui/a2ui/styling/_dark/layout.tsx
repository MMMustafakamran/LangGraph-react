// Doc: generative-ui/a2ui/styling "Dark mode" block, imported on its own; `.dark` on an ancestor.
import "@/a2ui/theme-dark.css";
export default function Layout({ children }: { children: React.ReactNode }) {
  return <div className="dark">{children}</div>;
}

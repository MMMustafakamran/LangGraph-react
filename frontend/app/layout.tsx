// [!code highlight:2]
import { Providers } from "./providers";
import "@copilotkit/react-core/v2/styles.css";
import './globals.css';

// ...
// HARNESS: the doc elides this part ("// ..."); kept from create-next-app.
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "LangGraph JS harness",
  description: "CopilotKit LangGraph (TypeScript) docs QA",
};

export default function RootLayout({ children }: {children: React.ReactNode}) {
  return (
    <html lang="en">
      <body>
        {/* [!code highlight:3] */}
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}

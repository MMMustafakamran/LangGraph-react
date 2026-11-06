"use client";
// Doc: generative-ui/components/surfaces "Add a page target" (FeaturedProducts) verbatim, and the
// "When a component fails" provider. HARNESS: Product / ProductRow (used, never defined on the page),
// sample products, and the layout around them.
import { CopilotKitProvider, CopilotChat } from "@copilotkit/react-core/v2";
import "@copilotkit/react-core/v2/styles.css";
import { GenerativeUISurface } from "@copilotkit/react-core/v2/generative-ui";
import { shopUI } from "../catalogs/catalog";

type Product = { name: string; price: number }; // HARNESS
function ProductRow({ products }: { products: Product[] }) { // HARNESS
  return <div className="flex gap-4">{products.map((p) => <div key={p.name} className="border p-3 rounded">{p.name} - ${p.price}</div>)}</div>;
}

export function FeaturedProducts({ products }: { products: Product[] }) {
  return (
    <GenerativeUISurface
      id="featured"
      ui={shopUI}
      description="The Featured Products row of the home page. When the customer asks to see products here, show them as a ProductGrid with one ProductCard for each product."
      components={["ProductGrid", "ProductCard"]}
      fallback={<ProductRow products={products} />}
    />
  );
}

export default function Page() {
  return (
    <CopilotKitProvider
      runtimeUrl="/api/copilotkit"
      generativeUI={{
        ui: shopUI,
        errorBoundary: {
          onError: (info) => console.warn(info.kind, info.surfaceId, info.error.message),
          fallback: ({ retry }) => <button onClick={retry}>Try again</button>,
        },
      }}
    >
      <div className="flex h-screen">
        <div className="flex-1 p-6"><h2 className="font-semibold mb-3">Featured Products</h2>
          <FeaturedProducts products={[{ name: "Classic Tee", price: 20 }, { name: "Canvas Tote", price: 15 }]} />
        </div>
        <div className="w-[420px] border-l"><CopilotChat agentId="genui_harness" /></div>
      </div>
    </CopilotKitProvider>
  );
}

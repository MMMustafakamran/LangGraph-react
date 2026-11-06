"use client";
// Doc: generative-ui/components/state-and-actions. The page shows `shopUI` in two separate
// createGenerativeUI blocks (one with `state` + `bind`, one with `functions` + `events`) and the
// ProductCard in a third. HARNESS: merged into one catalog so one card shows inCart and runs addToCart.
import { useState } from "react";
import { z } from "zod";
import { createGenerativeUI, type GenerativeUIComponentProps } from "@copilotkit/react-core/v2/generative-ui";

const cartSchema = z.object({
  items: z.array(z.object({ productId: z.string(), quantity: z.number() })),
});

// Doc ProductCard ("In the component, the event is a typed prop"), verbatim + HARNESS inCart line.
function ProductCard({ productId, name, onAddToCart, inCart }: GenerativeUIComponentProps<typeof shopUI, "ProductCard">) {
  const [error, setError] = useState<string>();
  return (
    <article>
      <h4>{name}</h4>
      <p>In cart: {inCart}</p>{/* HARNESS */}
      <button
        onClick={async () => {
          const result = await onAddToCart?.({ productId });
          if (result && !result.ok) setError(result.error.message);
        }}
      >
        Add to cart
      </button>
      {error ? <p role="alert">{error}</p> : null}
    </article>
  );
}

export const shopUI = createGenerativeUI({
  id: "acme/shop@1",
  state: { cart: cartSchema },
  functions: {
    addToCart: {
      description: "Add a product to the cart",
      parameters: z.object({ productId: z.string(), quantity: z.number().default(1) }),
    },
  },
  components: {
    ProductCard: {
      component: ProductCard,
      props: z.object({ productId: z.string(), name: z.string(), inCart: z.number() }),
      bind: {
        inCart: (state, { productId }) =>
          state.cart.items.find((item) => item.productId === productId)?.quantity ?? 0,
      },
      events: { onAddToCart: {} },
    },
  },
});

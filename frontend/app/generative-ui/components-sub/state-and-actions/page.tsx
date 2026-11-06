"use client";
// Doc: CartState + CartActions verbatim. HARNESS: Cart type/state (never defined on the page), provider, chat.
import { useState } from "react";
import { CopilotKitProvider, CopilotChat } from "@copilotkit/react-core/v2";
import "@copilotkit/react-core/v2/styles.css";
import { useGenerativeUIState, useGenerativeUIFunction } from "@copilotkit/react-core/v2/generative-ui";
import { shopUI } from "./catalog";

type Cart = { items: { productId: string; quantity: number }[]; addItem: (id: string, q: number) => void }; // HARNESS

function CartState({ cart }: { cart: Cart }) {
  useGenerativeUIState(shopUI, "cart", { items: cart.items });
  return null;
}

function CartActions({ cart }: { cart: Cart }) {
  useGenerativeUIFunction(shopUI, "addToCart", ({ productId, quantity }) => {
    cart.addItem(productId, quantity);
    return { added: productId };
  });
  return null;
}

export default function Page() {
  // HARNESS: a tiny cart
  const [items, setItems] = useState<Cart["items"]>([]);
  const cart: Cart = {
    items,
    addItem: (productId, quantity) =>
      setItems((prev) => {
        const hit = prev.find((i) => i.productId === productId);
        return hit ? prev.map((i) => (i.productId === productId ? { ...i, quantity: i.quantity + quantity } : i)) : [...prev, { productId, quantity }];
      }),
  };
  return (
    <CopilotKitProvider runtimeUrl="/api/copilotkit" generativeUI={{ ui: shopUI }}>
      <CartState cart={cart} />
      <CartActions cart={cart} />
      <div className="flex h-screen">
        <div className="w-56 border-r p-4 text-sm"><b>Cart</b>{items.map((i) => <div key={i.productId}>{i.productId} x {i.quantity}</div>)}</div>
        <div className="flex-1"><CopilotChat agentId="genui_harness" /></div>
      </div>
    </CopilotKitProvider>
  );
}

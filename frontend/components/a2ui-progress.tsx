// Doc: generative-ui/a2ui/advanced step 1, verbatim
"use client";

import { memo } from "react";

interface A2UIProgressProps {
  parameters: Record<string, unknown>;
}

export const A2UIProgress = memo(function A2UIProgress({
  parameters,
}: A2UIProgressProps) {
  // You can inspect `parameters` to show partial progress.
  // As the LLM streams, `parameters.components` and `parameters.items`
  // will progressively populate.
  const componentCount = Array.isArray(parameters?.components)
    ? parameters.components.length
    : 0;
  const itemCount = Array.isArray(parameters?.items)
    ? parameters.items.length
    : 0;

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
        <span>Building interface...</span>
      </div>
      {componentCount > 0 && (
        <p className="mt-2 text-xs text-gray-500">
          {componentCount} components, {itemCount} items
        </p>
      )}
    </div>
  );
});

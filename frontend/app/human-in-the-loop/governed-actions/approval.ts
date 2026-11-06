// Doc: governed-actions "On resume" block, verbatim. Not wired: the page shows no agent that calls it
// and executeSideEffect is never defined.
type ApprovalResponse = {
  approved: boolean;
  actionId: string;
  reference: string;
};

async function handleApproval(action: GovernedAction, response: ApprovalResponse) {
  if (
    response.approved &&
    response.actionId === action.id &&
    response.reference === action.reference
  ) {
    return executeSideEffect(action.tool, action.arguments);
  }

  return {
    skipped: true,
    reason: "The user did not approve this action.",
  };
}

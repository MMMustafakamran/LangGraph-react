/**
 * Page id -> action. Pages not listed run the standard prompt-and-reply take.
 * LangGraph (TypeScript) + React. Finding pages end with doc evidence + Notepad (REPOS.md Rule 6).
 */
import { type ActionContext, type PageActionHandler, type PageRecordConfig } from '../core/types';
import { runStandardAction } from '../core/actions';
import { type Page } from 'playwright';

import { waitForPageReady } from './page-ready';
import {
  runFrontendToolsAction,
  runFrontendToolsFixedAction,
  runHitlFixedAction,
  runSubagentsFixedAction,
  runHeadlessInterruptAction,
  runHitlAction,
  runInspectorAction,
  runInterruptFlowAction,
  runSharedStateAction,
  runStandardWithFinding,
  runUseInterruptAction,
  runTempNoteAction,
  runTempNotePickSlotAction,
  runFrontendCardsAction,
  runKeyboardSendAction,
  runGenuiFindingAction,
  runDocOnlyFindingAction,
  runReasoningFindingAction,
  runA2uiDynamicFindingAction,
  SCRIPTED,
} from './langgraph.actions';

/** Keys are page ids from `config/pages.config.ts`. Doctor flags any orphans. */
export const ACTION_MAP: Record<string, PageActionHandler> = {
  'frontend-tools': runFrontendToolsAction,
  'human-in-the-loop': runHitlAction,
  'use-interrupt': runUseInterruptAction,
  'headless-interrupts': runHeadlessInterruptAction,
  'interrupt-flow': runInterruptFlowAction,
  'shared-state': runSharedStateAction,
  inspector: runInspectorAction,
  reasoning: runReasoningFindingAction,
  'a2ui-dynamic': runA2uiDynamicFindingAction,
  components: runGenuiFindingAction,
  'mcp-apps': runStandardWithFinding,
  subagents: runStandardWithFinding,
  'frontend-tools-fixed': runFrontendToolsFixedAction,
  'hitl-fixed': runHitlFixedAction,
  'subagents-fixed': runSubagentsFixedAction,
  // Batch 2
  'headless-ui': runKeyboardSendAction,
  'json-render': runKeyboardSendAction,
  'a2ui-fixed': runKeyboardSendAction,
  'components-catalogs': runGenuiFindingAction,
  'components-surfaces': runGenuiFindingAction,
  'components-theming': runKeyboardSendAction,
  'components-standard-catalog': runKeyboardSendAction,
  'components-from-a2ui': runKeyboardSendAction,
  'components-state-actions': runGenuiFindingAction,
  'components-markdown-mode': runKeyboardSendAction,
  'hashbrown': runKeyboardSendAction,
  display: runTempNoteAction,
  interactive: runTempNotePickSlotAction,
  'programmatic-control': runTempNotePickSlotAction,
  'agent-config': runTempNoteAction,
  'frontend-cards': runFrontendCardsAction,
  'workflow-execution': runStandardWithFinding,
  'a2ui-styling': runStandardWithFinding,
  'tool-based': runTempNoteAction,
  'reasoning-messages': runStandardWithFinding,
  'rendering-in-app': runStandardWithFinding,
  configurable: runDocOnlyFindingAction, // docOnlyAction: doc evidence + Notepad after the doc read
  // Scripted takes override the entries above.
  ...SCRIPTED,
};

export async function executePageAction(
  page: Page,
  config: PageRecordConfig,
  rootPath: string,
  ctx: ActionContext,
): Promise<void> {
  if (!config.docOnly) await waitForPageReady(page, { label: config.id });

  const handler = ACTION_MAP[config.id] ?? runStandardAction;
  await handler(page, config, rootPath, ctx);
}

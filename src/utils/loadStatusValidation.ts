// src/utils/loadStatusValidation.ts

import { LOAD_STATUS_WORKFLOW, type LoadStatus } from '@/constants/loadStatusWorkflow';

/**
 * Validates that a status transition is valid (only one step forward/backward)
 * @param currentStatus The current load status
 * @param newStatus The proposed new status
 * @returns true if the transition is valid, false otherwise
 */
export function isValidStatusTransition(
  currentStatus: LoadStatus,
  newStatus: LoadStatus
): boolean {
  const currentIndex = LOAD_STATUS_WORKFLOW.indexOf(currentStatus);
  const newIndex = LOAD_STATUS_WORKFLOW.indexOf(newStatus);

  if (currentIndex === -1 || newIndex === -1) {
    console.error('Invalid status provided:', { currentStatus, newStatus });
    return false;
  }

  // Allow moving forward one step or backward one step
  const diff = newIndex - currentIndex;
  return Math.abs(diff) === 1;
}

/**
 * Gets the next allowed status in the workflow
 * @param currentStatus The current load status
 * @returns The next status or null if already at the end
 */
export function getNextStatus(currentStatus: LoadStatus): LoadStatus | null {
  const currentIndex = LOAD_STATUS_WORKFLOW.indexOf(currentStatus);
  if (currentIndex === -1 || currentIndex === LOAD_STATUS_WORKFLOW.length - 1) {
    return null;
  }
  return LOAD_STATUS_WORKFLOW[currentIndex + 1];
}

/**
 * Gets the previous status in the workflow
 * @param currentStatus The current load status
 * @returns The previous status or null if already at the beginning
 */
export function getPreviousStatus(currentStatus: LoadStatus): LoadStatus | null {
  const currentIndex = LOAD_STATUS_WORKFLOW.indexOf(currentStatus);
  if (currentIndex === -1 || currentIndex === 0) {
    return null;
  }
  return LOAD_STATUS_WORKFLOW[currentIndex - 1];
}

/**
 * Gets all allowed next statuses (for workflows that might allow skipping)
 * @param currentStatus The current load status
 * @returns Array of allowed next statuses
 */
export function getAllowedNextStatuses(currentStatus: LoadStatus): LoadStatus[] {
  const currentIndex = LOAD_STATUS_WORKFLOW.indexOf(currentStatus);
  if (currentIndex === -1 || currentIndex === LOAD_STATUS_WORKFLOW.length - 1) {
    return [];
  }
  // For now, only allow one step forward
  return [LOAD_STATUS_WORKFLOW[currentIndex + 1]];
}
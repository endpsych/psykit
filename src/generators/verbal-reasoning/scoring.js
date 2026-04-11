// Verbal Reasoning — validation guardrails

import {
  buildClaimRefutation,
  buildPresentedClaim,
  buildValidClaim,
  evaluateClaimAgainstDraft,
} from './refutation';

export function validateConditionalDraft(draft, settings, distractors) {
  const messages = [];

  const validClaim = buildValidClaim(draft);
  const validEvaluation = evaluateClaimAgainstDraft(draft, validClaim);

  if (!validEvaluation || validEvaluation.premModels === 0) {
    messages.push({
      level: 'warning',
      message: 'No premise-compatible models were found for this item. Review the generated logic before using it.',
    });
  } else if (validEvaluation.holds === validEvaluation.premModels) {
    messages.push({
      level: 'success',
      message: `Truth-table verification: the keyed answer holds in all ${validEvaluation.premModels} premise-compatible model(s).`,
    });
  } else {
    messages.push({
      level: 'warning',
      message: `Truth-table verification failed: the keyed answer holds in ${validEvaluation.holds} of ${validEvaluation.premModels} premise-compatible model(s).`,
    });
  }

  let presentedRefutation = null;
  if (!draft.isMCFormat && !draft.conclusionIsValid) {
    const presentedClaim = buildPresentedClaim(draft);
    presentedRefutation = buildClaimRefutation(draft, presentedClaim);

    if (presentedRefutation) {
      if (presentedRefutation.evaluation.validity === 'contingent' && presentedRefutation.counterexample) {
        messages.push({
          level: 'success',
          message: 'The presented conclusion is invalidated by a counterexample that satisfies every premise.',
        });
      } else if (presentedRefutation.evaluation.validity === 'contradicted') {
        messages.push({
          level: 'success',
          message: 'The presented conclusion is contradicted by the premises and cannot be derived.',
        });
      } else if (presentedRefutation.evaluation.validity === 'valid') {
        messages.push({
          level: 'warning',
          message: 'The presented conclusion also holds in every premise-compatible model. Review this item before using it.',
        });
      }
    }
  }

  if (settings.includeNegation) {
    const negCount = (draft.predicates || []).filter(p => p.negated).length;
    if (negCount >= 3) {
      messages.push({
        level: 'warning',
        message: `High negation load: ${negCount} negated predicates can make the logical form harder to read cleanly.`,
      });
    }
  }

  if ((draft.chainLength || 1) >= 4) {
    messages.push({
      level: 'warning',
      message: 'This item uses the longest available premise chain. Review it for readability and surface clarity.',
    });
  }

  if (draft.isMCFormat && distractors) {
    if (distractors.length < 3) {
      messages.push({
        level: 'warning',
        message: `Only ${distractors.length} refuted distractor(s) were generated; 3 are needed for a full 4-option item.`,
      });
    } else {
      messages.push({
        level: 'info',
        message: `Generated ${distractors.length} refuted distractor(s) for the multiple-choice format.`,
      });
    }
  }

  const status = messages.some(m => m.level === 'warning') ? 'review' : 'ready';

  return {
    messages,
    status,
    analyses: {
      validEvaluation,
      presentedRefutation,
    },
  };
}

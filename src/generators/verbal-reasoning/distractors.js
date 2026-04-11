// Verbal Reasoning — Distractor generation
//
// Binary items analyze the one presented-but-wrong response option. MC items
// still use generated alternative claims to fill the option set.

import { buildBinaryResponseDistractor, buildRefutedDistractors } from './refutation';

export function buildConditionalDistractors(draft, settings) {
  if (!draft.isMCFormat) {
    const binaryResponseDistractor = buildBinaryResponseDistractor(draft);
    return binaryResponseDistractor ? [binaryResponseDistractor] : [];
  }

  return buildRefutedDistractors(draft, settings);
}

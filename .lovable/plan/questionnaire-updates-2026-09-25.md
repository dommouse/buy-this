# Questionnaire updates

## Build
- Replace Question 1 emojis with a cohesive set of small branded lion illustrations, one visual cue per relationship.
- Show an exact-age number field (0–17) for child relationships, while teen/adult paths use the revised age ranges.
- Update the seven budget tiers and their labels.
- Add the mutually exclusive “I don't really know 🤷” interest option with a distinct dashed style.
- Preserve the existing one-question flow, navigation, validation, progress, and visual system.

## Technical details
- Store the selected exact age in the existing age answer field so results navigation remains compatible.
- Keep the unknown-interest value in the existing interests array, enforcing exclusivity in the selection handler.
- Generate optimized local image assets for the relationship illustrations; no external image links.
- Verify child and adult paths, exclusivity behavior, budget choices, mobile layout, and current preview diagnostics.

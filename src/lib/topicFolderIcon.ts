/** Decorative MaterialCommunityIcons names — deterministic pick per topic. */
const ICON_NAMES = [
  "lightbulb-outline",
  "thought-bubble-outline",
  "checkbox-marked-circle-outline",
  "star-four-points",
  "book-open-variant",
  "archive-outline",
  "flower-tulip",
  "weather-night",
  "heart-outline",
  "music-note",
] as const;

export type TopicFolderIconName = (typeof ICON_NAMES)[number];

export function topicFolderIconName(
  normalizedName: string,
): TopicFolderIconName {
  let h = 0;
  for (let i = 0; i < normalizedName.length; i++) {
    h = (h + normalizedName.charCodeAt(i) * (i + 1)) % 2147483647;
  }
  return ICON_NAMES[h % ICON_NAMES.length];
}

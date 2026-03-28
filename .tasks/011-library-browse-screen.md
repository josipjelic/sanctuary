---
id: "011"
title: "Build library / tag-filtered browse view"
status: "todo"
area: "mobile"
agent: "@react-native-developer"
priority: "normal"
created_at: "2026-03-28"
due_date: null
started_at: null
completed_at: null
prd_refs: ["FR-021", "FR-022", "FR-023", "FR-042"]
blocks: []
blocked_by: ["009"]
---

## Description

Build the Library screen — an alternative view of the user's thoughts organized by tag. The top of the screen shows a tag cloud or horizontal scroll of all tags the user has. Selecting a tag shows a filtered list of thoughts with that tag. Daily check-in history entries are also accessible from this screen (in a dedicated "Check-ins" section or filter). The Library is reached from the main navigation (bottom tab or drawer).

## Acceptance Criteria

- [ ] Tag cloud or horizontal tag scroll at the top showing all unique tags with thought counts
- [ ] Selecting a tag filters the thought list below to show only thoughts with that tag
- [ ] "All" filter shows all thoughts (same as inbox, different layout)
- [ ] "Check-ins" section or filter shows daily check-in history entries
- [ ] Thoughts displayed in the same card format as the inbox
- [ ] Screen adheres to design system
- [ ] Empty tag state: "No thoughts tagged '[tag]' yet." message

## Technical Notes

- Tags query: `SELECT DISTINCT unnest(tags) as tag, COUNT(*) FROM thoughts WHERE user_id = auth.uid() GROUP BY tag`
- Can reuse thought card component from task #009
- Check-in entries use a different card style (mood + intention summary)

## History

| Date | Agent / Human | Event |
|------|--------------|-------|
| 2026-03-28 | human | Task created during onboarding |

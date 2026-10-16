# Garden downloads and high contrast

Garden images, duets, pressed flowers and calendar reminders share a filename
formatter. It preserves non-Latin names and accents, removes unsafe separators,
and adds a timestamp so saved keepsakes are distinguishable. Calendar contents
and opening times are unchanged.

- [Desktop](details2-garden-1440-none.png)
- [Phone](details2-garden-390-none.png)
- [Desktop with forced colors](details2-garden-1440-active.png)
- [Phone with forced colors](details2-garden-390-active.png)

The isolated browser review downloads both an image and an opening reminder for
a garden with a Korean recipient name. Captures show keyboard focus on the copy
control in both display modes. The filename test was checked against a deliberate
ASCII-only regression, then restored and passed. Native share sheets and actual
assistive technology remain device checks.

High-contrast selections use a heavier bottom rule while labels retain native
system text colors. This avoids text backplates obscuring a filled selection.

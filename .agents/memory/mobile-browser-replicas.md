---
name: Mobile browser replicas
description: Durable guidance for recreating mobile screenshots inside the mockup sandbox.
---

When recreating a mobile browser screenshot as a live mockup, treat the browser chrome as part of the viewport rather than ordinary document content: pin the address bar and Android navigation bar to the bottom, and reserve document space beneath the page content.

**Why:** The supplied references show browser controls fixed at the bottom while the portal content scrolls behind them. Rendering them in normal flow makes the first viewport visibly diverge and hides the controls during screenshot review.

**How to apply:** Use fixed bottom layers with appropriate z-index, add bottom padding to the page, and verify at the reference viewport size before presenting the canvas frame.
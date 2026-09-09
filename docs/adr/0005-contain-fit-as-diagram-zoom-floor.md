# Contain-fit as the diagram zoom floor

The diagram viewer previously let users zoom out to a fixed floor (10%) regardless of the loaded Event Model's size. For small models this left most of the viewport as dead, pannable, blank space; the "canvas" (the diagram's wrapper element) also always reserved a full-viewport-sized box even when the diagram itself was much smaller, so there was blank space to pan into even before zooming out.

We considered a "cover" formula for the zoom floor — `max(viewport width / diagram width, viewport height / diagram height)` — which guarantees the diagram always fills the viewport with no blank margins, matching how `background-size: cover` works. We rejected this: cover deliberately lets the diagram overflow the viewport in whichever dimension isn't the constraint, which reintroduces a scrollbar and off-screen content in that dimension at the "floor" zoom — precisely the state we're trying to eliminate as the resting/default state.

Instead Fit Zoom uses "contain": `min(viewport width / diagram width, viewport height / diagram height)`. This is the zoom level at which the diagram is as large as possible while remaining fully visible with no scrollbars in either dimension — margin is only introduced in the non-constraining dimension (centered via flexbox), never a scrollbar. Fit Zoom is:
- the default zoom whenever a model is freshly loaded (`FILE_LOADED`),
- the hard floor zooming out can reach — it is recomputed and clamped up to on every content change (`MODEL_CHANGED`, `FILTER_TOGGLED`), editor-panel resize (`EDITOR_RESIZED`), and window resize,
- uncapped above 100% — a small model on a large viewport gets a Fit Zoom greater than 100%, so "Fit Zoom" and "100% zoom" are different concepts and must not be conflated (the reset button targets Fit Zoom, not a literal 100%).

Zooming in past Fit Zoom remains free and uncapped, and produces scrollbars as expected once the diagram exceeds the viewport.

**Consequences:** the diagram's wrapper element must be sized in JS to the diagram's actual on-screen (post-zoom) pixel footprint rather than left to fill its container — CSS transforms don't shrink an element's layout box, so without this the wrapper would keep reserving the diagram's full unscaled size regardless of zoom, and the container's flex-centering and scrollbar calculations would remain wrong. PNG/SVG export, which needs the diagram at its native unscaled 1:1 layout for correct output resolution, must bypass the zoom floor directly rather than calling the normal zoom setter, since native 1:1 can be below Fit Zoom for small models on large screens.

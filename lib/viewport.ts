export function observeViewport(
  element: Element,
  onSize: (size: { width: number; height: number }) => void,
) {
  let frame = 0;
  let previous = { width: 0, height: 0 };
  const observer = new ResizeObserver(([entry]) => {
    const box = entry.borderBoxSize[0];
    const width = Math.round(box.inlineSize);
    const height = Math.round(box.blockSize);
    cancelAnimationFrame(frame);
    // Publish after observation delivery, so React layout cannot retrigger it in this frame.
    frame = requestAnimationFrame(() => {
      if (
        width > 0 &&
        height > 0 &&
        (width !== previous.width || height !== previous.height)
      ) {
        previous = { width, height };
        onSize(previous);
      }
    });
  });
  observer.observe(element, { box: 'border-box' });
  return () => {
    observer.disconnect();
    cancelAnimationFrame(frame);
  };
}

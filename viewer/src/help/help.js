const helpBtn = document.getElementById('helpBtn');
const helpOverlay = document.getElementById('helpOverlay');
const helpOverlayClose = document.getElementById('helpOverlayClose');

function setHelpOpen(open) {
    helpOverlay.hidden = !open;
    helpBtn.classList.toggle('active', open);
    helpBtn.setAttribute('aria-expanded', String(open));
}

helpBtn.addEventListener('click', () => {
    setHelpOpen(helpOverlay.hidden);
});

helpOverlayClose.addEventListener('click', () => {
    setHelpOpen(false);
});

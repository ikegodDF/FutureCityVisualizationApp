export const createEditMenuBar = ({ title = '編集メニュー' } = {}) => {
  const root = document.createElement('div');
  root.className = 'edit-menu-bar';

  const panel = document.createElement('div');
  panel.className = 'edit-menu-panel';

  const panelHeader = document.createElement('div');
  panelHeader.className = 'edit-menu-header';
  const panelTitle = document.createElement('span');
  panelTitle.textContent = title;
  panelHeader.appendChild(panelTitle);

  const panelContent = document.createElement('div');
  panelContent.className = 'edit-menu-content';

  const handle = document.createElement('div');
  handle.className = 'edit-menu-handle';
  const toggleButton = document.createElement('div');
  toggleButton.className = 'edit-menu-toggle';
  toggleButton.setAttribute('role', 'button');
  toggleButton.setAttribute('tabindex', '0');
  toggleButton.setAttribute('aria-label', `${title}を開く`);
  toggleButton.textContent = '⌄';
  handle.appendChild(toggleButton);

  panel.appendChild(panelHeader);
  panel.appendChild(panelContent);
  panel.appendChild(handle);

  root.appendChild(panel);

  let isOpen = false;
  const updateOffset = () => {
    const panelHeight = Math.ceil(panel.getBoundingClientRect().height);
    document.body.style.setProperty('--general-edit-menu-offset', `${panelHeight}px`);
  };

  const setOpen = (open) => {
    isOpen = open;
    updateOffset();
    root.classList.toggle('is-open', isOpen);
    document.body.classList.toggle('general-edit-menu-open', isOpen);
    if (!isOpen) {
      document.body.style.setProperty('--general-edit-menu-offset', '0px');
    }
    toggleButton.setAttribute('aria-label', isOpen ? `${title}を閉じる` : `${title}を開く`);
    toggleButton.textContent = isOpen ? '⌃' : '⌄';
  };

  toggleButton.addEventListener('click', () => {
    setOpen(!isOpen);
  });
  toggleButton.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setOpen(!isOpen);
    }
  });
  window.addEventListener('resize', () => {
    if (isOpen) updateOffset();
  });

  return {
    element: root,
    content: panelContent,
    setOpen,
  };
};
